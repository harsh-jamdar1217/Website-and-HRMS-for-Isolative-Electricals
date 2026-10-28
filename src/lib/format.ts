const TZ = "Asia/Kolkata";

export function fmtDateTime(d: Date | number | null | undefined): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }).format(d);
}

export function fmtDate(d: Date | number | null | undefined): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: TZ }).format(d);
}

/** yyyy-mm-dd for <input type="date"> */
export function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
