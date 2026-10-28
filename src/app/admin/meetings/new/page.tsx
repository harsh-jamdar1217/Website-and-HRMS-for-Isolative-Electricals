import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { Flash } from "@/components/admin";
import { MeetingForm } from "@/components/MeetingForm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { invitableUsers } from "@/lib/meetings";

export const metadata: Metadata = { title: "New meeting" };
export const dynamic = "force-dynamic";

export default async function NewMeeting({ searchParams }: { searchParams: Promise<{ applicationId?: string }> }) {
  const user = await requirePermission("meeting:manage", "/admin/meetings/new");
  const { applicationId } = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  let interview;
  if (applicationId) {
    const row = db.select({ app: schema.applications, cand: schema.users, vacancy: schema.vacancies.title }).from(schema.applications)
      .innerJoin(schema.users, eq(schema.users.id, schema.applications.candidateId)).innerJoin(schema.vacancies, eq(schema.vacancies.id, schema.applications.vacancyId)).where(eq(schema.applications.id, applicationId)).get();
    if (row) interview = { applicationId, candidateId: row.cand.id, candidateName: row.cand.name, vacancy: row.vacancy };
  }
  const people = invitableUsers().filter((p) => p.id !== user.id);
  return (
    <div>
      <Link href="/admin/meetings" className="text-sm font-semibold">All meetings</Link>
      <h1 className="mb-5 mt-2 text-3xl">{interview ? "Schedule an interview" : "New meeting"}</h1>
      {applicationId && !interview && <Flash err="That application was not found." />}
      <MeetingForm people={people} today={today} interview={interview} />
    </div>
  );
}
