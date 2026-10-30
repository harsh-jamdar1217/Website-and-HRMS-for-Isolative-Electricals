/**
 * Isolative Electricals - database schema (Phase 1).
 *
 * Status columns are plain text validated in code (src/lib/status.ts) so the schema ports cleanly
 * between SQLite (development) and PostgreSQL (production): swap `drizzle-orm/sqlite-core` for
 * `drizzle-orm/pg-core` and regenerate migrations.
 */
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date());

export const users = sqliteTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(), // stored lower-case
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(), // CANDIDATE | EMPLOYEE | HR | ADMIN
    emailVerifiedAt: integer("email_verified_at", { mode: "timestamp_ms" }),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true), // false blocks login + revokes sessions
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email), index("users_role_idx").on(t.role)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    tokenHash: text("token_hash").notNull(), // SHA-256 of the cookie token; raw token is never stored
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const enquiries = sqliteTable(
  "enquiries",
  {
    id: id(),
    reference: text("reference").notNull(), // ENQ-2026-7K3M9Q: random, not sequential, so it cannot be enumerated
    name: text("name").notNull(),
    company: text("company"),
    email: text("email").notNull(),
    phone: text("phone"),
    category: text("category").notNull(), // PRODUCT | QUOTATION | SUPPORT | PARTNERSHIP | OTHER
    message: text("message").notNull(),
    status: text("status").notNull().default("NEW"), // NEW | IN_PROGRESS | RESPONDED | CONVERTED | CLOSED
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    followUpDate: integer("follow_up_date", { mode: "timestamp_ms" }),
    consentAt: integer("consent_at", { mode: "timestamp_ms" }).notNull(), // privacy-notice acceptance time
    catalogueItemId: text("catalogue_item_id"), // the product/service page the visitor asked from (no FK constraint: items can be removed without touching history)
    itemTitle: text("item_title"), // snapshot of the title at the time, so history stays readable
    dedupeKey: text("dedupe_key").notNull(), // hash(email + message) to absorb double submissions
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("enquiries_reference_uq").on(t.reference),
    index("enquiries_status_idx").on(t.status, t.createdAt),
    index("enquiries_email_idx").on(t.email),
    index("enquiries_dedupe_idx").on(t.dedupeKey, t.createdAt),
  ],
);

export const enquiryNotes = sqliteTable(
  "enquiry_notes",
  {
    id: id(),
    enquiryId: text("enquiry_id").notNull().references(() => enquiries.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull().references(() => users.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("enquiry_notes_idx").on(t.enquiryId, t.createdAt)],
);

/**
 * Private internal client record. This is NOT the public client list:
 * `showPublicly` stays false unless the client has authorised display of their name/logo.
 */
export const clients = sqliteTable(
  "clients",
  {
    id: id(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    showPublicly: integer("show_publicly", { mode: "boolean" }).notNull().default(false),
    sourceEnquiryId: text("source_enquiry_id").references(() => enquiries.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("clients_source_enquiry_uq").on(t.sourceEnquiryId)],
);

export const emailLogs = sqliteTable(
  "email_logs",
  {
    id: id(),
    idempotencyKey: text("idempotency_key").notNull(), // same key => never sent twice
    toAddress: text("to_address").notNull(),
    template: text("template").notNull(),
    subject: text("subject").notNull(),
    bodyText: text("body_text"), // null for sensitive emails (tokens): they cannot be re-sent from the log
    bodyHtml: text("body_html"),
    icsContent: text("ics_content"), // calendar invitation (.ics) attached to the email, if any
    status: text("status").notNull(), // PENDING | SENT | LOGGED | FAILED
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    relatedType: text("related_type"),
    relatedId: text("related_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("email_logs_key_uq").on(t.idempotencyKey), index("email_logs_status_idx").on(t.status, t.createdAt)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: id(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(), // e.g. enquiry.status_changed
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    details: text("details"), // small JSON string; never secrets or full PII dumps
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId), index("audit_created_idx").on(t.createdAt)],
);

// ---------------------------------------------------------------------------
// Phase 2: recruitment
// ---------------------------------------------------------------------------

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(), // EMAIL_VERIFY
    tokenHash: text("token_hash").notNull(), // SHA-256; the raw token only ever exists in the emailed link
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("vtoken_hash_uq").on(t.tokenHash), index("vtoken_user_idx").on(t.userId, t.purpose)],
);

export const vacancies = sqliteTable(
  "vacancies",
  {
    id: id(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    department: text("department"),
    location: text("location").notNull(),
    employmentType: text("employment_type").notNull(), // FULL_TIME | PART_TIME | CONTRACT | INTERNSHIP
    description: text("description").notNull(),
    eligibility: text("eligibility").notNull(),
    status: text("status").notNull().default("DRAFT"), // DRAFT | PUBLISHED | CLOSED
    closesAt: integer("closes_at", { mode: "timestamp_ms" }),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("vacancies_slug_uq").on(t.slug), index("vacancies_status_idx").on(t.status)],
);

/** Editable personal details a candidate keeps on their profile (kept apart from the login record). */
export const candidateProfiles = sqliteTable("candidate_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  phone: text("phone"),
  city: text("city"),
  qualification: text("qualification"),
  experienceYears: integer("experience_years"),
  summary: text("summary"),
  updatedAt: updatedAt(),
});

export const applications = sqliteTable(
  "applications",
  {
    id: id(),
    reference: text("reference").notNull(), // APP-2026-XXXXXX
    candidateId: text("candidate_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    vacancyId: text("vacancy_id").notNull().references(() => vacancies.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("PENDING_VERIFICATION"),
    coverNote: text("cover_note"),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }), // when documents were sent for review
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("applications_reference_uq").on(t.reference),
    uniqueIndex("applications_candidate_vacancy_uq").on(t.candidateId, t.vacancyId), // one application per vacancy
    index("applications_status_idx").on(t.status, t.createdAt),
  ],
);

export const applicationEvents = sqliteTable(
  "application_events",
  {
    id: id(),
    applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"), // shown to the candidate in their timeline, so keep it candidate-safe
    createdAt: createdAt(),
  },
  (t) => [index("app_events_idx").on(t.applicationId, t.createdAt)],
);

export const documents = sqliteTable(
  "documents",
  {
    id: id(),
    applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // RESUME | ID_PROOF | EDUCATION | OTHER
    originalName: text("original_name").notNull(), // sanitised display name only; never used as a path
    storageKey: text("storage_key").notNull(), // random file name inside private storage
    mimeType: text("mime_type").notNull(), // detected from file content, not from the browser
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    scanStatus: text("scan_status").notNull().default("NOT_SCANNED"), // NOT_SCANNED | CLEAN | INFECTED
    reviewStatus: text("review_status").notNull().default("PENDING"), // PENDING | ACCEPTED | REJECTED
    reviewNote: text("review_note"),
    supersededAt: integer("superseded_at", { mode: "timestamp_ms" }), // set when the candidate re-uploads this type
    uploadedAt: createdAt(),
  },
  (t) => [uniqueIndex("documents_key_uq").on(t.storageKey), index("documents_app_idx").on(t.applicationId)],
);

// ---------------------------------------------------------------------------
// Phase 3b: employees and onboarding
// ---------------------------------------------------------------------------

/** Atomic counters (e.g. employee numbers). Incremented inside a transaction. */
export const counters = sqliteTable("counters", {
  name: text("name").primaryKey(),
  value: integer("value").notNull().default(0),
});

/**
 * An employee is created ONLY by an authorised HR conversion of an accepted application.
 * The same login (users row) is promoted, so there is never a duplicate identity, and the recruitment
 * history stays attached through applicationId. Unique constraints stop double conversion.
 */
export const employees = sqliteTable(
  "employees",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "restrict" }),
    employeeCode: text("employee_code").notNull(), // EMP-0001
    department: text("department").notNull(),
    jobTitle: text("job_title").notNull(),
    employmentType: text("employment_type").notNull(),
    joiningDate: integer("joining_date", { mode: "timestamp_ms" }).notNull(),
    status: text("status").notNull().default("ONBOARDING"), // ONBOARDING | ACTIVE | NOTICE_PERIOD | EXITED
    addressLine: text("address_line"),
    emergencyName: text("emergency_name"),
    emergencyPhone: text("emergency_phone"),
    emergencyRelation: text("emergency_relation"),
    onboardingCompletedAt: integer("onboarding_completed_at", { mode: "timestamp_ms" }),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("employees_user_uq").on(t.userId),
    uniqueIndex("employees_application_uq").on(t.applicationId),
    uniqueIndex("employees_code_uq").on(t.employeeCode),
    index("employees_status_idx").on(t.status),
  ],
);

export const onboardingTasks = sqliteTable(
  "onboarding_tasks",
  {
    id: id(),
    employeeId: text("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    owner: text("owner").notNull(), // EMPLOYEE | HR
    status: text("status").notNull().default("PENDING"), // PENDING | DONE
    sortOrder: integer("sort_order").notNull().default(0),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    completedById: text("completed_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("onboarding_task_uq").on(t.employeeId, t.key)],
);

// ---------------------------------------------------------------------------
// Phase 4: meetings and calendar
// ---------------------------------------------------------------------------

export const meetings = sqliteTable(
  "meetings",
  {
    id: id(),
    uid: text("uid").notNull(), // stable calendar UID so updates replace the same event in people's calendars
    title: text("title").notNull(),
    type: text("type").notNull(), // INTERVIEW | CLIENT | INTERNAL | ORIENTATION
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(), // UTC; shown in IST
    durationMin: integer("duration_min").notNull(),
    location: text("location"),
    meetingLink: text("meeting_link"),
    agenda: text("agenda"),
    status: text("status").notNull().default("SCHEDULED"), // SCHEDULED | CANCELLED
    cancelReason: text("cancel_reason"),
    sequence: integer("sequence").notNull().default(0), // +1 on every reschedule (calendar clients need this)
    organizerId: text("organizer_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    applicationId: text("application_id").references(() => applications.id, { onDelete: "set null" }), // set for interviews
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("meetings_uid_uq").on(t.uid), index("meetings_start_idx").on(t.startsAt), index("meetings_app_idx").on(t.applicationId)],
);

export const meetingParticipants = sqliteTable(
  "meeting_participants",
  {
    id: id(),
    meetingId: text("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }), // null for external guests (e.g. a client)
    name: text("name").notNull(),
    email: text("email").notNull(),
  },
  (t) => [uniqueIndex("meeting_participant_uq").on(t.meetingId, t.email), index("meeting_participant_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Phase 5: products and services catalogue (admin-editable)
// ---------------------------------------------------------------------------

export const catalogueItems = sqliteTable(
  "catalogue_items",
  {
    id: id(),
    slug: text("slug").notNull(), // stable public URL: /products/<slug>
    title: text("title").notNull(),
    category: text("category").notNull(), // group heading on the products page
    kind: text("kind").notNull().default("SERVICE"), // SERVICE | PRODUCT
    summary: text("summary").notNull(), // one or two sentences for the listing card
    description: text("description").notNull(),
    highlights: text("highlights"), // one bullet per line: "What is included"
    applications: text("applications"), // one per line: industries / places where it is used
    facts: text("facts"), // one "Label: value" per line
    imagePath: text("image_path"), // optional, must be a file under /public/catalogue
    status: text("status").notNull().default("DRAFT"), // DRAFT | PUBLISHED
    sortOrder: integer("sort_order").notNull().default(100),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("catalogue_slug_uq").on(t.slug), index("catalogue_status_idx").on(t.status, t.category, t.sortOrder)],
);

export type User = typeof users.$inferSelect;
export type Enquiry = typeof enquiries.$inferSelect;
export type EnquiryNote = typeof enquiryNotes.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type EmailLog = typeof emailLogs.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

export type Vacancy = typeof vacancies.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type CandidateProfile = typeof candidateProfiles.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type OnboardingTask = typeof onboardingTasks.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type MeetingParticipant = typeof meetingParticipants.$inferSelect;
export type CatalogueItem = typeof catalogueItems.$inferSelect;
