# Isolative Electricals: Website + HRMS (Phases 1-5)

Public website, client enquiries, **careers and recruitment** (vacancies, apply, email verification, candidate portal,
private document upload, HR review, decision emails), staff login with role-based access, email log and audit trail.
**Employee records and onboarding** are built: HR converts a candidate who accepted an offer into an employee (ID, role, department, joining date), a checklist guides onboarding, and the employee gets their own portal. **Meetings and calendar** are built too, and the **public Products and services catalogue** (14 items drafted from the company's own IndiaMART profile) is editable by the administrator. The employee exit workflow is the next phase (see Roadmap).

**Demo vacancies are fictional** ("(Demo)" in the title). Replace them in Admin > Vacancies before showing anything to the company.

## Run it (Windows / macOS / Linux)

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm run setup               # creates the SQLite database, applies migrations, seeds demo data
npm run dev                 # http://localhost:3000
```

Demo logins (development seed only; change before real use):

| Role  | Email                      | Password       |
|-------|----------------------------|----------------|
| Admin | admin@isolative.example    | Admin@12345    |
| HR    | hr@isolative.example       | Hr@12345678    |

HR owns recruitment (vacancies, candidates, documents) but deliberately cannot open enquiries, clients, emails or audit: try it to see server-side RBAC.
Candidates register by applying on the Careers page. Without a real mailbox, find the verification link in Mailpit (http://localhost:8025).

### Seeing emails (recommended for the demo)
Run [Mailpit](https://mailpit.axllent.org) (single binary, no account). It listens on SMTP 1025 and shows messages at http://localhost:8025.
The default `.env` already points to it. If no mail server is running, enquiries are still saved and the failure is
visible in **Admin > Email log** (with a Retry button): by design, a mail outage never loses an enquiry.
Set `SMTP_HOST=` (empty) to skip sending entirely; emails are then recorded as LOGGED.

## Commands
| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build and run |
| `npm test` | 53 service tests (real temporary database): enquiries, recruitment rules, document security |
| `npm run typecheck` | TypeScript check |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:reset` | Delete the dev database, migrate and re-seed |

## Structure
```
src/db/schema.ts        Tables (Drizzle ORM). Statuses are validated in code, schema stays portable
src/lib/                Business logic: enquiries, auth/sessions, permissions, email, audit, validation
src/app/actions/        Server actions (every mutation re-checks permission on the server)
src/app/(site)/         Public + candidate pages (careers, candidate portal)
src/app/admin/          Staff portal (enquiries, candidates, vacancies, logs)
src/app/api/documents/  The ONLY route that serves uploaded files (authorised per request)
src/content/company.ts  The ONLY place company facts live (verified vs placeholder is marked)
drizzle/                SQL migrations      tests/  scripts/    Tests, seed, smoke test
```

## What is verified vs placeholder
- Verified (public registry data): legal name, CIN, registered office, incorporation year (derived from CIN).
- **Placeholders to replace with company-supplied content:** tagline, contact email/phone, product catalogue (empty on purpose),
  About-page narrative, privacy notice text and retention periods. No clients, statistics or certifications are invented.

## Recruitment flow
Apply (creates candidate account + application, status *Awaiting verification*) > emailed single-use link (24h) > confirm button >
*Documents needed* > upload (PDF/JPG/PNG, 5 MB) > candidate sends for review > HR reviews each document, requests a correction or shortlists >
select (email) or reject (polite email, internal reason kept staff-only) > candidate accepts the offer. A candidate becomes an *employee*
only through a later, separate HR action (Phase 3b); recruitment history is kept.
Business rules enforced in code: resume required to submit; resume must be accepted to shortlist; all documents accepted to select;
correction needs a reason; rejected applications are final; candidates can only withdraw, resubmit or accept their own offer.

## Employee conversion and onboarding
Only HR (or an admin) can convert, and only from **Offer accepted**. The same login is promoted to the Employee role (no duplicate identity), the application
becomes **Hired** and keeps its full history, an ID such as `EMP-0001` is issued from an atomic counter, and a six-task checklist is created
(`ONBOARDING_TEMPLATE` in `src/lib/employees.ts`). Employee tasks complete themselves (saving contact details; HR accepting the bank proof or signed joining form);
HR ticks the HR tasks; **Complete onboarding** needs every task done, then the employee becomes Active and is emailed.
Bank proof and the joining form are requested only after hiring, not during recruitment (data minimisation). Confirm with the company which documents they really need.

## Meetings and calendar
Staff (HR, admin) schedule meetings: interviews (from a shortlisted candidate's page), client meetings, internal meetings, orientations.
- **Conflict checks:** nobody can be double-booked (organiser included); back-to-back is fine; cancelled meetings free the slot. Check and save happen in one transaction.
- **Invitations:** every participant gets an email with a standard `.ics` file, so it lands in Google Calendar / Outlook / Apple Calendar with no API integration.
  Reschedules re-send with the same event ID and a higher version number (so calendars update the existing entry); cancellations send a CANCEL entry with the reason.
- **Views:** month-grid calendar and an upcoming list for staff (India time); candidates see their own interview on their application page; employees see their meetings in the portal.
- **Reminders:** "Send due reminders" emails everyone for meetings in the next 24 h, once per schedule. For automatic reminders set `CRON_SECRET` and call `POST /api/cron/reminders` from any scheduler.
  Delivery failures are reported honestly (never counted as sent) and retried on the next run.
- External guests (e.g. a client) get the invitation but their calendars cannot be checked. Participants are fixed at creation: to change them, cancel and re-create.

## Products and services catalogue
`/products` lists services and products grouped by category; each item has its own page (`/products/<slug>`) with description, what is included, where it is used,
quick facts, related items, and an **enquiry form tied to that item**. The admin sees what the visitor asked about, and both emails name the item.
Administrators manage items under **Admin > Products and services** (create as draft, edit, publish/unpublish; URLs never change after creation; photos only from `public/catalogue/`, no external image URLs).
Run `npm run db:seed` on an existing database to load the initial 14 items (it never overwrites existing content).
Content provenance and open questions for the company are in `docs/content-review.md`.

## Security controls
Documents: type detected from file **content** (browser MIME and extension ignored), 5 MB cap, random storage names, private folder,
sanitised display names, per-request authorisation, 404 (not 403) for other people's files, staff downloads audited, replaced files kept as history.
Email verification link opens a page and needs a button press, so mail scanners cannot burn the token.
Earlier controls:
Passwords hashed with bcrypt (cost 12) and a minimum policy; DB-backed sessions (random token in an httpOnly, SameSite=Lax cookie, only its SHA-256 stored)
so sessions can be revoked; generic login errors + timing equalisation; login and enquiry rate limits; Zod validation on the server;
parameterised queries only; React output escaping and HTML-escaped emails; email header-injection stripping; honeypot; CSRF protection through
Next.js server-action Origin checks; security headers; unguessable enquiry references; open-redirect guard; audit log of status/assignment/conversion actions.

## Known limitations (honest list)
- SQLite and in-memory rate limiting suit a demo and a single server, not production. Move to PostgreSQL + a shared limiter first.
- No password reset or MFA yet. Uploaded files are **not virus-scanned** (a ClamAV hook exists in `src/lib/documents.ts`; the UI says "Not virus-scanned").
- Registration reveals whether an email already has an account (common trade-off in recruiting forms; mitigated by rate limits).
- Interview scheduling and offer letters (PDF) are not built yet.
- Employees edit their own contact details directly; the "changes need HR approval" workflow is not built yet.
- The onboarding checklist and joining documents are sensible defaults, not the company's confirmed process.
- No live Google/Outlook calendar sync (deliberately: `.ics` invitations cover the need without credentials). Reminders need the button or an external scheduler.
- Privacy notice is a draft; DPDP compliance needs legal review (core DPDP obligations phase in from May 2027).
- Not yet visually tested across real browsers/devices; run an accessibility pass (keyboard, screen reader) before sign-off.

## Roadmap
Done: recruitment, HR review + decision emails, candidate-to-employee conversion, onboarding checklist, employee portal.
Next: employee exit/offboarding (resignation, approval, clearance checklist, access revocation) ·
Phase 4 meetings/calendar · Phase 5 employee portal + exit workflow.
