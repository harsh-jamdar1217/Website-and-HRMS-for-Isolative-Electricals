/** Minimal RFC 5545 calendar-invitation builder (no dependency). Works in Google Calendar, Outlook and Apple Calendar. */

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Lines longer than 75 octets must be folded (continuation lines start with a space). */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > 74) { out.push(cur); cur = " " + ch; } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
}

export type IcsInput = {
  uid: string; sequence: number; method: "REQUEST" | "CANCEL";
  title: string; startsAt: Date; durationMin: number;
  location?: string | null; description?: string | null;
  organizer: { name: string; email: string }; attendee: { name: string; email: string };
};

export function buildIcs(i: IcsInput): string {
  const end = new Date(i.startsAt.getTime() + i.durationMin * 60_000);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Isolative Electricals//Portal//EN", "CALSCALE:GREGORIAN", `METHOD:${i.method}`,
    "BEGIN:VEVENT",
    `UID:${i.uid}`, `SEQUENCE:${i.sequence}`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(i.startsAt)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(i.title)}`,
    ...(i.location ? [`LOCATION:${esc(i.location)}`] : []),
    ...(i.description ? [`DESCRIPTION:${esc(i.description)}`] : []),
    `ORGANIZER;CN=${esc(i.organizer.name)}:mailto:${i.organizer.email}`,
    `ATTENDEE;CN=${esc(i.attendee.name)};ROLE=REQ-PARTICIPANT:mailto:${i.attendee.email}`,
    `STATUS:${i.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
