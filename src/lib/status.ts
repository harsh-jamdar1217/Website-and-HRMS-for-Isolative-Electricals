/** Single source of truth for statuses, labels and allowed transitions. */

export const ROLES = ["CANDIDATE", "EMPLOYEE", "HR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ENQUIRY_CATEGORIES = {
  PRODUCT: "Product information",
  QUOTATION: "Quotation request",
  SUPPORT: "Technical support",
  PARTNERSHIP: "Partnership or supply",
  OTHER: "Something else",
} as const;
export type EnquiryCategory = keyof typeof ENQUIRY_CATEGORIES;

export const ENQUIRY_STATUS_LABEL = {
  NEW: "New",
  IN_PROGRESS: "In progress",
  RESPONDED: "Responded",
  CONVERTED: "Converted to client",
  CLOSED: "Closed",
} as const;
export type EnquiryStatus = keyof typeof ENQUIRY_STATUS_LABEL;

/** Allowed manual transitions. CONVERTED is only reachable through the "convert to client" action. */
export const ENQUIRY_TRANSITIONS: Record<EnquiryStatus, EnquiryStatus[]> = {
  NEW: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["RESPONDED", "CLOSED"],
  RESPONDED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: ["IN_PROGRESS"], // reopen
  CONVERTED: [], // terminal
};

export function canTransition(from: string, to: string): boolean {
  return (ENQUIRY_TRANSITIONS[from as EnquiryStatus] ?? []).includes(to as EnquiryStatus);
}

export function isEnquiryStatus(v: string): v is EnquiryStatus {
  return v in ENQUIRY_STATUS_LABEL;
}

// ---------------------------------------------------------------------------
// Phase 2: recruitment
// ---------------------------------------------------------------------------

export const EMPLOYMENT_TYPES = { FULL_TIME: "Full time", PART_TIME: "Part time", CONTRACT: "Contract", INTERNSHIP: "Internship" } as const;
export const VACANCY_STATUS_LABEL = { DRAFT: "Draft", PUBLISHED: "Published", CLOSED: "Closed" } as const;
export type VacancyStatus = keyof typeof VACANCY_STATUS_LABEL;

export const APPLICATION_STATUS_LABEL = {
  PENDING_VERIFICATION: "Awaiting email verification",
  DOCS_PENDING: "Documents needed",
  UNDER_REVIEW: "Under review",
  CORRECTION_REQUESTED: "Correction requested",
  SHORTLISTED: "Shortlisted",
  SELECTED: "Selected",
  OFFER_ACCEPTED: "Offer accepted",
  HIRED: "Hired",
  REJECTED: "Not selected",
  WITHDRAWN: "Withdrawn",
} as const;
export type ApplicationStatus = keyof typeof APPLICATION_STATUS_LABEL;

export type Actor = "candidate" | "staff" | "system";

/** Every legal application transition and WHO may trigger it. The service layer enforces this; the UI only reflects it. */
export const APPLICATION_TRANSITIONS: { from: ApplicationStatus; to: ApplicationStatus; by: Actor }[] = [
  { from: "PENDING_VERIFICATION", to: "DOCS_PENDING", by: "system" },
  { from: "DOCS_PENDING", to: "UNDER_REVIEW", by: "candidate" },
  { from: "CORRECTION_REQUESTED", to: "UNDER_REVIEW", by: "candidate" },
  { from: "UNDER_REVIEW", to: "CORRECTION_REQUESTED", by: "staff" },
  { from: "UNDER_REVIEW", to: "SHORTLISTED", by: "staff" },
  { from: "UNDER_REVIEW", to: "REJECTED", by: "staff" },
  { from: "DOCS_PENDING", to: "REJECTED", by: "staff" },
  { from: "SHORTLISTED", to: "SELECTED", by: "staff" },
  { from: "SHORTLISTED", to: "REJECTED", by: "staff" },
  { from: "SELECTED", to: "OFFER_ACCEPTED", by: "candidate" },
  ...(["PENDING_VERIFICATION", "DOCS_PENDING", "UNDER_REVIEW", "CORRECTION_REQUESTED", "SHORTLISTED", "SELECTED"] as const).map(
    (from) => ({ from, to: "WITHDRAWN" as const, by: "candidate" as const }),
  ),
];

export function canMoveApplication(from: string, to: string, by: Actor): boolean {
  return APPLICATION_TRANSITIONS.some((t) => t.from === from && t.to === to && t.by === by);
}
export function nextStatuses(from: string, by: Actor): ApplicationStatus[] {
  return APPLICATION_TRANSITIONS.filter((t) => t.from === from && t.by === by).map((t) => t.to);
}
export const TERMINAL_APPLICATION: ApplicationStatus[] = ["REJECTED", "WITHDRAWN", "HIRED"];

/** Statuses in which the candidate may still edit details and upload documents. */
export const CANDIDATE_EDITABLE: ApplicationStatus[] = ["DOCS_PENDING", "CORRECTION_REQUESTED"];

export const CANDIDATE_DOC_TYPES = {
  RESUME: "Resume / CV",
  ID_PROOF: "Identity proof",
  EDUCATION: "Education certificate",
  OTHER: "Other supporting document",
} as const;
/** Collected only AFTER hiring, during onboarding (kept out of the recruitment upload list on purpose: data minimisation). */
export const ONBOARDING_DOC_TYPES = {
  BANK_PROOF: "Bank account proof",
  JOINING_FORM: "Signed joining form",
} as const;
export const DOCUMENT_TYPES = { ...CANDIDATE_DOC_TYPES, ...ONBOARDING_DOC_TYPES } as const;
export type DocumentType = keyof typeof DOCUMENT_TYPES;

export const EMPLOYEE_STATUS_LABEL = { ONBOARDING: "Onboarding", ACTIVE: "Active", NOTICE_PERIOD: "Notice period", EXITED: "Exited" } as const;
export type EmployeeStatus = keyof typeof EMPLOYEE_STATUS_LABEL;
export const DOC_REVIEW_LABEL = { PENDING: "Awaiting review", ACCEPTED: "Accepted", REJECTED: "Needs replacing" } as const;

// ---------------------------------------------------------------------------
// Phase 4: meetings
// ---------------------------------------------------------------------------
export const MEETING_TYPES = { INTERVIEW: "Interview", CLIENT: "Client meeting", INTERNAL: "Internal meeting", ORIENTATION: "Orientation" } as const;
export type MeetingType = keyof typeof MEETING_TYPES;
export const MEETING_STATUS_LABEL = { SCHEDULED: "Scheduled", CANCELLED: "Cancelled" } as const;
