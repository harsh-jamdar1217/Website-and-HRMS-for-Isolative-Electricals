import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { db, schema } from "@/db";

export type OutgoingEmail = {
  to: string;
  template: string;
  subject: string;
  text: string;
  html: string;
  /** Same key => sent at most once, even if the calling operation is retried. */
  idempotencyKey: string;
  relatedType?: string;
  relatedId?: string;
  /** Optional calendar invitation (.ics text). The METHOD line inside it (REQUEST/CANCEL) is used for the email part. */
  ics?: string;
  /** Sensitive emails (tokens/links) are not stored in the log, so they cannot be replayed from it. */
  sensitive?: boolean;
};

const clean = (s: string) => s.replace(/[\r\n]+/g, " ").trim(); // blocks header injection

function transport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 25),
    secure: false,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

/** Deliver one logged email. Never throws: a mail outage must not roll back a successful business action. */
async function deliver(logId: string, mail: { to: string; subject: string; text: string; html: string; ics?: string | null }) {
  const t = transport();
  const current = db.select().from(schema.emailLogs).where(eq(schema.emailLogs.id, logId)).get();
  const attempts = (current?.attempts ?? 0) + 1;
  try {
    if (!t) {
      console.log(`[email:LOGGED] to=${mail.to} subject="${mail.subject}"`);
      db.update(schema.emailLogs).set({ status: "LOGGED", attempts, lastError: null }).where(eq(schema.emailLogs.id, logId)).run();
      return;
    }
    const method = mail.ics?.match(/METHOD:([A-Z]+)/)?.[1] ?? "REQUEST";
    await t.sendMail({ from: process.env.MAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, ...(mail.ics ? { icalEvent: { method, content: mail.ics } } : {}) });
    db.update(schema.emailLogs).set({ status: "SENT", attempts, lastError: null }).where(eq(schema.emailLogs.id, logId)).run();
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 300) : "Unknown mail error";
    console.error(`[email:FAILED] to=${mail.to} ${message}`);
    db.update(schema.emailLogs).set({ status: "FAILED", attempts, lastError: message }).where(eq(schema.emailLogs.id, logId)).run();
  }
}

export async function sendEmail(mail: OutgoingEmail): Promise<{ status: string; skipped: boolean }> {
  const subject = clean(mail.subject);
  const inserted = db
    .insert(schema.emailLogs)
    .values({
      idempotencyKey: mail.idempotencyKey,
      toAddress: clean(mail.to),
      template: mail.template,
      subject,
      bodyText: mail.sensitive ? null : mail.text,
      bodyHtml: mail.sensitive ? null : mail.html,
      icsContent: mail.ics ?? null,
      status: "PENDING",
      relatedType: mail.relatedType,
      relatedId: mail.relatedId,
    })
    .onConflictDoNothing()
    .returning({ id: schema.emailLogs.id })
    .get();

  if (!inserted) {
    // Already attempted. Only a previously FAILED email is re-attempted; delivered ones are skipped.
    const existing = db.select().from(schema.emailLogs).where(eq(schema.emailLogs.idempotencyKey, mail.idempotencyKey)).get()!;
    if (existing.status !== "FAILED") return { status: existing.status, skipped: true };
    await deliver(existing.id, { to: existing.toAddress, subject, text: mail.text, html: mail.html, ics: mail.ics });
  } else {
    await deliver(inserted.id, { to: clean(mail.to), subject, text: mail.text, html: mail.html, ics: mail.ics });
  }
  const final = db.select().from(schema.emailLogs).where(eq(schema.emailLogs.idempotencyKey, mail.idempotencyKey)).get()!;
  return { status: final.status, skipped: false };
}

/** Admin-triggered retry of a FAILED email whose body was stored. */
export async function retryEmail(logId: string): Promise<{ ok: boolean; reason?: string }> {
  const row = db.select().from(schema.emailLogs).where(eq(schema.emailLogs.id, logId)).get();
  if (!row) return { ok: false, reason: "Email not found." };
  if (row.status !== "FAILED") return { ok: false, reason: "Only failed emails can be retried." };
  if (!row.bodyText || !row.bodyHtml) return { ok: false, reason: "This email's content was not stored (sensitive), so it cannot be resent from the log." };
  await deliver(row.id, { to: row.toAddress, subject: row.subject, text: row.bodyText, html: row.bodyHtml, ics: row.icsContent });
  return { ok: true };
}
