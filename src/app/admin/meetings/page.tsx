import type { Metadata } from "next";
import Link from "next/link";
import { remindersAction } from "@/app/actions/meetings";
import { Empty, Flash } from "@/components/admin";
import { SubmitButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { fmtWhen, listBetween, listUpcoming, parseIst } from "@/lib/meetings";
import { can } from "@/lib/permissions";
import { MEETING_TYPES } from "@/lib/status";

export const metadata: Metadata = { title: "Meetings" };
export const dynamic = "force-dynamic";

const ymdIst = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
const hm = (d: Date) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(d).replace(" ", "").toLowerCase();
const TYPE_STYLE: Record<string, string> = { INTERVIEW: "border-l-amber-700 bg-amber/15", CLIENT: "border-l-ok bg-ok/10", INTERNAL: "border-l-navy bg-navy-50", ORIENTATION: "border-l-steel bg-sheet" };

export default async function Meetings({ searchParams }: { searchParams: Promise<{ month?: string; view?: string; ok?: string; err?: string }> }) {
  const user = await requirePermission("meeting:view", "/admin/meetings");
  const manage = can(user.role, "meeting:manage");
  const { month, view, ok, err } = await searchParams;
  const todayYmd = ymdIst(new Date());
  const ym = /^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? "") ? month! : todayYmd.slice(0, 7);
  const [Y, M] = ym.split("-").map(Number);
  const shift = (n: number) => { const d = new Date(Date.UTC(Y, M - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  const monthName = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(Y, M - 1, 1)));

  // Monday-first grid covering whole weeks
  const first = new Date(Date.UTC(Y, M - 1, 1)), last = new Date(Date.UTC(Y, M, 0));
  const gridStart = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * 86400_000);
  const gridEnd = new Date(last.getTime() + ((7 - ((last.getUTCDay() + 6) % 7) - 1) % 7) * 86400_000);
  const days: string[] = [];
  for (let t = gridStart.getTime(); t <= gridEnd.getTime(); t += 86400_000) days.push(new Date(t).toISOString().slice(0, 10));
  const rangeStart = parseIst(days[0], "00:00"), rangeEnd = new Date(parseIst(days[days.length - 1], "00:00").getTime() + 86400_000);
  const inGrid = view === "list" ? [] : listBetween(rangeStart, rangeEnd);
  const byDay = new Map<string, typeof inGrid>();
  for (const r of inGrid) { const k = ymdIst(r.m.startsAt); byDay.set(k, [...(byDay.get(k) ?? []), r]); }
  const upcoming = view === "list" ? listUpcoming(100) : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Meetings</h1>
        <div className="flex flex-wrap gap-2">
          {manage && <form action={remindersAction}><SubmitButton className="btn btn-ghost" pending="Sending...">Send due reminders</SubmitButton></form>}
          {manage && <Link href="/admin/meetings/new" className="btn btn-primary no-underline">New meeting</Link>}
        </div>
      </div>
      <div className="mt-4"><Flash ok={ok} err={err} /></div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex border border-line bg-white text-sm font-semibold">
          <Link href={`/admin/meetings?month=${ym}`} aria-current={view !== "list" ? "page" : undefined} className={`px-4 py-2 no-underline ${view !== "list" ? "bg-navy text-white" : ""}`}>Calendar</Link>
          <Link href="/admin/meetings?view=list" aria-current={view === "list" ? "page" : undefined} className={`px-4 py-2 no-underline ${view === "list" ? "bg-navy text-white" : ""}`}>Upcoming list</Link>
        </div>
        {view !== "list" && (
          <div className="flex items-center gap-3"><Link href={`/admin/meetings?month=${shift(-1)}`} className="btn btn-ghost btn-sm no-underline" aria-label="Previous month">Previous</Link>
            <span className="min-w-36 text-center text-lg font-semibold text-navy" aria-live="polite">{monthName}</span>
            <Link href={`/admin/meetings?month=${shift(1)}`} className="btn btn-ghost btn-sm no-underline" aria-label="Next month">Next</Link>
            <Link href="/admin/meetings" className="text-sm font-semibold">Today</Link></div>)}
      </div>

      {view === "list" ? (
        upcoming.length === 0 ? <Empty title="No upcoming meetings">{manage ? "Schedule one with the New meeting button." : "Nothing is scheduled."}</Empty> : (
          <div className="overflow-x-auto border border-line bg-white"><table className="tbl">
            <thead><tr><th>When (India time)</th><th>Meeting</th><th>Type</th><th>Where</th><th>Organiser</th></tr></thead>
            <tbody>{upcoming.map(({ m, organizer }) => (
              <tr key={m.id}><td className="whitespace-nowrap">{fmtWhen(m.startsAt)}<span className="block text-xs text-steel">{m.durationMin} min</span></td>
                <td><Link href={`/admin/meetings/${m.id}`} className="font-semibold">{m.title}</Link></td><td>{MEETING_TYPES[m.type as keyof typeof MEETING_TYPES]}</td><td>{m.location ?? "Online"}</td><td>{organizer}</td></tr>))}</tbody>
          </table></div>)
      ) : (
        <div className="overflow-x-auto"><div className="min-w-[44rem] border border-line bg-line">
          <div className="grid grid-cols-7 gap-px">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="bg-white px-2 py-2 text-xs font-semibold text-steel">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-px">
            {days.map((d) => {
              const items = byDay.get(d) ?? [];
              const inMonth = d.slice(0, 7) === ym;
              return (
                <div key={d} className={`min-h-28 p-1.5 ${inMonth ? "bg-white" : "bg-sheet"}`}>
                  <p className={`mb-1 text-xs font-semibold ${d === todayYmd ? "inline-block bg-navy px-1.5 py-0.5 text-white" : inMonth ? "text-navy" : "text-steel/60"}`}>{Number(d.slice(8))}</p>
                  <ul className="space-y-1">
                    {items.slice(0, 3).map(({ m }) => (
                      <li key={m.id}><Link href={`/admin/meetings/${m.id}`} className={`block truncate border-l-4 px-1.5 py-0.5 text-xs no-underline ${TYPE_STYLE[m.type] ?? ""} ${m.status === "CANCELLED" ? "line-through opacity-60" : ""}`} title={`${m.title}, ${hm(m.startsAt)}`}>
                        <span className="font-semibold">{hm(m.startsAt)}</span> {m.title}</Link></li>))}
                    {items.length > 3 && <li className="px-1 text-xs text-steel">+{items.length - 3} more</li>}
                  </ul>
                </div>);
            })}
          </div></div></div>
      )}
      {view !== "list" && <p className="mt-3 text-xs text-steel">Times are India Standard Time. Cancelled meetings are struck through.</p>}
    </div>
  );
}
