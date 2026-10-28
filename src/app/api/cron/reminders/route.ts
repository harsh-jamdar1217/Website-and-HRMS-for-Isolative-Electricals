import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sendDueReminders } from "@/lib/meetings";

export const dynamic = "force-dynamic";

/**
 * Hook for an external scheduler (Windows Task Scheduler, cron, a hosting cron job):
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/cron/reminders
 * Disabled unless CRON_SECRET is set. Safe to call as often as you like: each person is reminded once per schedule.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse("Not configured", { status: 404 });
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  const ok = got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  if (!ok) return new NextResponse("Unauthorised", { status: 401 });
  return NextResponse.json(await sendDueReminders(24, null));
}
