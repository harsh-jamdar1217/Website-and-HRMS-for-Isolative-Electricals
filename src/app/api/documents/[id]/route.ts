import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { auditDownload, readStored } from "@/lib/documents";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
const notFound = () => new NextResponse("Not found", { status: 404 });

/**
 * The ONLY way to read a stored document. Authorisation happens on every request:
 * the owning candidate, or staff holding candidate:documents. Everyone else (including
 * other candidates guessing ids) gets the same 404 as a missing file.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorised", { status: 401 });

  const row = db
    .select({ doc: schema.documents, ownerId: schema.applications.candidateId })
    .from(schema.documents)
    .innerJoin(schema.applications, eq(schema.applications.id, schema.documents.applicationId))
    .where(eq(schema.documents.id, id))
    .get();
  if (!row) return notFound();

  const isOwner = row.ownerId === user.id; // the person the file belongs to (candidate, later employee)
  const isStaff = can(user.role, "candidate:documents");
  if (!isOwner && !isStaff) return notFound();
  if (isStaff) auditDownload(user.id, row.doc); // every staff download is recorded

  let body: Buffer;
  try { body = await readStored(row.doc.storageKey); } catch { return notFound(); }
  const safeName = row.doc.originalName.replace(/[^A-Za-z0-9._() -]/g, "_");
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": row.doc.mimeType, // detected from content at upload time, never the browser's claim
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Content-Length": String(body.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
