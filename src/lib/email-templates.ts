import { company } from "@/content/company";
import { ENQUIRY_CATEGORIES, type EnquiryCategory } from "./status";

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const wrap = (title: string, bodyHtml: string) => `<!doctype html><html><body style="margin:0;background:#f3f5f4;font-family:Segoe UI,Arial,sans-serif;color:#1b2631">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #c9d1d5">
<tr><td style="background:#12324a;color:#fff;padding:16px 24px;font-size:16px;font-weight:600">${esc(company.legalName)}</td></tr>
<tr><td style="padding:24px;line-height:1.55;font-size:15px"><h1 style="font-size:18px;margin:0 0 12px">${esc(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #c9d1d5;font-size:12px;color:#52606d">This is an automated message. ${esc(company.registeredAddress)}</td></tr>
</table></td></tr></table></body></html>`;

export function enquiryAcknowledgement(p: { name: string; reference: string }) {
  const subject = `We received your enquiry (${p.reference})`;
  const text = `Hello ${p.name},\n\nThank you for contacting ${company.legalName}. Your enquiry reference is ${p.reference}.\nOur team will review it and reply by email. Please quote the reference in any follow-up.\n\n${company.legalName}`;
  const html = wrap(
    "We received your enquiry",
    `<p>Hello ${esc(p.name)},</p><p>Thank you for contacting ${esc(company.legalName)}. Your enquiry reference is <strong>${esc(p.reference)}</strong>.</p><p>Our team will review it and reply by email. Please quote the reference in any follow-up.</p>`,
  );
  return { subject, text, html };
}

export function enquiryAdminNotification(p: {
  reference: string; name: string; company: string | null; email: string; category: EnquiryCategory; message: string; url: string;
}) {
  const cat = ENQUIRY_CATEGORIES[p.category];
  const subject = `New enquiry ${p.reference}: ${cat}`;
  const text = `New enquiry ${p.reference}\nFrom: ${p.name}${p.company ? ` (${p.company})` : ""} <${p.email}>\nType: ${cat}\n\n${p.message}\n\nOpen: ${p.url}`;
  const html = wrap(
    `New enquiry ${p.reference}`,
    `<p><strong>${esc(p.name)}</strong>${p.company ? ` (${esc(p.company)})` : ""}<br>${esc(p.email)}<br>Type: ${esc(cat)}</p>
     <p style="white-space:pre-wrap;border-left:3px solid #e3a008;padding-left:12px">${esc(p.message)}</p>
     <p><a href="${esc(p.url)}">Open in the admin portal</a></p>`,
  );
  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Recruitment emails. None contains passwords. Only the verification email contains a secret link.
// ---------------------------------------------------------------------------
const btn = (url: string, label: string) =>
  `<p><a href="${esc(url)}" style="display:inline-block;background:#12324a;color:#fff;padding:10px 18px;text-decoration:none;font-weight:600">${esc(label)}</a></p>`;

export function verifyEmail(p: { name: string; url: string; vacancy: string }) {
  return {
    subject: "Confirm your email address",
    text: `Hello ${p.name},\n\nPlease confirm your email to continue your application for ${p.vacancy}:\n${p.url}\n\nThe link works once and expires in 24 hours. If you did not apply, ignore this message.`,
    html: wrap("Confirm your email address", `<p>Hello ${esc(p.name)},</p><p>Please confirm your email to continue your application for <strong>${esc(p.vacancy)}</strong>.</p>${btn(p.url, "Confirm my email")}<p style="font-size:13px;color:#52606d">The link works once and expires in 24 hours. If you did not apply, ignore this message.</p>`),
  };
}

export function applicationReceived(p: { name: string; reference: string; vacancy: string; url: string }) {
  return {
    subject: `Application received (${p.reference})`,
    text: `Hello ${p.name},\n\nYour email is confirmed and your application for ${p.vacancy} is registered. Reference: ${p.reference}.\nNext, sign in and upload your documents: ${p.url}`,
    html: wrap("Application received", `<p>Hello ${esc(p.name)},</p><p>Your email is confirmed and your application for <strong>${esc(p.vacancy)}</strong> is registered.</p><p>Reference: <strong>${esc(p.reference)}</strong></p><p>Next, sign in and upload your documents.</p>${btn(p.url, "Open my application")}`),
  };
}

export function documentsSubmitted(p: { name: string; reference: string }) {
  return {
    subject: `Documents received (${p.reference})`,
    text: `Hello ${p.name},\n\nWe have received your documents for application ${p.reference}. Our HR team will review them and contact you by email.`,
    html: wrap("Documents received", `<p>Hello ${esc(p.name)},</p><p>We have received your documents for application <strong>${esc(p.reference)}</strong>. Our HR team will review them and contact you by email.</p>`),
  };
}

export function hrNewSubmission(p: { reference: string; candidate: string; vacancy: string; url: string }) {
  return {
    subject: `Application ready for review: ${p.reference}`,
    text: `${p.candidate} has submitted documents for ${p.vacancy} (${p.reference}).\nReview: ${p.url}`,
    html: wrap("Application ready for review", `<p><strong>${esc(p.candidate)}</strong> has submitted documents for <strong>${esc(p.vacancy)}</strong> (${esc(p.reference)}).</p>${btn(p.url, "Review application")}`),
  };
}

export function correctionRequested(p: { name: string; reference: string; note: string; url: string }) {
  return {
    subject: `Action needed on your application (${p.reference})`,
    text: `Hello ${p.name},\n\nOur HR team needs a correction on application ${p.reference}:\n\n${p.note}\n\nPlease sign in, update and resubmit: ${p.url}`,
    html: wrap("Action needed on your application", `<p>Hello ${esc(p.name)},</p><p>Our HR team needs a correction on application <strong>${esc(p.reference)}</strong>:</p><p style="white-space:pre-wrap;border-left:3px solid #e3a008;padding-left:12px">${esc(p.note)}</p>${btn(p.url, "Update my application")}`),
  };
}

export function applicationSelected(p: { name: string; reference: string; vacancy: string; note: string | null; url: string }) {
  return {
    subject: `Good news about your application (${p.reference})`,
    text: `Hello ${p.name},\n\nWe are pleased to tell you that you have been selected for ${p.vacancy}.${p.note ? `\n\n${p.note}` : ""}\n\nPlease sign in to confirm that you accept: ${p.url}`,
    html: wrap("You have been selected", `<p>Hello ${esc(p.name)},</p><p>We are pleased to tell you that you have been selected for <strong>${esc(p.vacancy)}</strong>.</p>${p.note ? `<p style="white-space:pre-wrap">${esc(p.note)}</p>` : ""}<p>Please sign in to confirm that you accept.</p>${btn(p.url, "Open my application")}`),
  };
}

export function applicationRejected(p: { name: string; reference: string; vacancy: string }) {
  return {
    subject: `Update on your application (${p.reference})`,
    text: `Hello ${p.name},\n\nThank you for your interest in ${p.vacancy}. After careful consideration we will not be taking your application forward at this time. We wish you every success.`,
    html: wrap("Update on your application", `<p>Hello ${esc(p.name)},</p><p>Thank you for your interest in <strong>${esc(p.vacancy)}</strong>. After careful consideration we will not be taking your application forward at this time.</p><p>We wish you every success.</p>`),
  };
}

export function employeeWelcome(p: { name: string; code: string; jobTitle: string; joiningDate: string; url: string }) {
  return {
    subject: `Welcome to Isolative Electricals (${p.code})`,
    text: `Hello ${p.name},\n\nWelcome aboard. You will join as ${p.jobTitle} on ${p.joiningDate}. Your employee ID is ${p.code}.\nPlease sign in with the same email and password and complete your onboarding checklist: ${p.url}`,
    html: wrap("Welcome aboard", `<p>Hello ${esc(p.name)},</p><p>You will join as <strong>${esc(p.jobTitle)}</strong> on <strong>${esc(p.joiningDate)}</strong>. Your employee ID is <strong>${esc(p.code)}</strong>.</p><p>Sign in with the same email and password and complete your onboarding checklist.</p>${btn(p.url, "Open my employee portal")}`),
  };
}

export function onboardingComplete(p: { name: string; code: string }) {
  return {
    subject: `Onboarding complete (${p.code})`,
    text: `Hello ${p.name},\n\nYour onboarding is complete and your employee record (${p.code}) is now active.`,
    html: wrap("Onboarding complete", `<p>Hello ${esc(p.name)},</p><p>Your onboarding is complete and your employee record (<strong>${esc(p.code)}</strong>) is now active.</p>`),
  };
}

// ---------------------------------------------------------------------------
// Meeting emails
// ---------------------------------------------------------------------------
type MeetingMail = { title: string; when: string; durationMin: number; location: string | null; link: string | null; agenda: string | null; organizer: string; name: string };
const details = (m: MeetingMail) =>
  `<table style="border-collapse:collapse;margin:8px 0"><tr><td style="padding:2px 12px 2px 0;color:#52606d">When</td><td><strong>${esc(m.when)}</strong> (${m.durationMin} min, India time)</td></tr>` +
  (m.location ? `<tr><td style="padding:2px 12px 2px 0;color:#52606d">Where</td><td>${esc(m.location)}</td></tr>` : "") +
  (m.link ? `<tr><td style="padding:2px 12px 2px 0;color:#52606d">Link</td><td><a href="${esc(m.link)}">${esc(m.link)}</a></td></tr>` : "") +
  `<tr><td style="padding:2px 12px 2px 0;color:#52606d">Organiser</td><td>${esc(m.organizer)}</td></tr></table>` +
  (m.agenda ? `<p style="white-space:pre-wrap;border-left:3px solid #e3a008;padding-left:12px">${esc(m.agenda)}</p>` : "");
const detailsText = (m: MeetingMail) =>
  `When: ${m.when} (${m.durationMin} min, India time)${m.location ? `\nWhere: ${m.location}` : ""}${m.link ? `\nLink: ${m.link}` : ""}\nOrganiser: ${m.organizer}${m.agenda ? `\n\n${m.agenda}` : ""}`;

export function meetingInvitation(m: MeetingMail) {
  return { subject: `Invitation: ${m.title}, ${m.when}`, text: `Hello ${m.name},\n\nYou are invited to ${m.title}.\n${detailsText(m)}\n\nA calendar file is attached.`, html: wrap(`Invitation: ${m.title}`, `<p>Hello ${esc(m.name)},</p><p>You are invited to <strong>${esc(m.title)}</strong>.</p>${details(m)}<p style="font-size:13px;color:#52606d">A calendar file is attached so you can add it to your calendar.</p>`) };
}
export function meetingUpdated(m: MeetingMail) {
  return { subject: `Updated: ${m.title}, ${m.when}`, text: `Hello ${m.name},\n\n${m.title} has been rescheduled or changed. New details:\n${detailsText(m)}`, html: wrap(`Updated: ${m.title}`, `<p>Hello ${esc(m.name)},</p><p><strong>${esc(m.title)}</strong> has been rescheduled or changed. New details:</p>${details(m)}`) };
}
export function meetingCancelled(m: MeetingMail & { reason: string | null }) {
  return { subject: `Cancelled: ${m.title}, ${m.when}`, text: `Hello ${m.name},\n\n${m.title} on ${m.when} has been cancelled.${m.reason ? `\n\nReason: ${m.reason}` : ""}`, html: wrap(`Cancelled: ${m.title}`, `<p>Hello ${esc(m.name)},</p><p><strong>${esc(m.title)}</strong> on ${esc(m.when)} has been cancelled.</p>${m.reason ? `<p style="white-space:pre-wrap">Reason: ${esc(m.reason)}</p>` : ""}`) };
}
export function meetingReminder(m: MeetingMail) {
  return { subject: `Reminder: ${m.title}, ${m.when}`, text: `Hello ${m.name},\n\nA reminder about ${m.title}.\n${detailsText(m)}`, html: wrap(`Reminder: ${m.title}`, `<p>Hello ${esc(m.name)},</p><p>A reminder about <strong>${esc(m.title)}</strong>.</p>${details(m)}`) };
}
