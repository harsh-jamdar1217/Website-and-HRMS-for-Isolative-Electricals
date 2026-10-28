import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/db";
import { can, type Permission } from "./permissions";

export const SESSION_COOKIE = "iep_session";
const SESSION_HOURS = 8;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  const h = await headers();
  db.insert(schema.sessions)
    .values({ tokenHash: sha256(token), userId, expiresAt, userAgent: h.get("user-agent")?.slice(0, 200) ?? null })
    .run();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Resolve the logged-in user for this request (null if none, expired, or deactivated). Cached per request. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .get();
  if (!row || !row.user.isActive) return null;
  return row.user;
});

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(token))).run();
  jar.delete(SESSION_COOKIE);
}

/** Revoke every session of a user (used on deactivation / password change). */
export function revokeAllSessions(userId: string): void {
  db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
}

/** For pages/layouts: redirect to login when anonymous, to /forbidden when lacking permission. */
export async function requirePermission(permission: Permission, nextPath = "/admin") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!can(user.role, "admin:access") || !can(user.role, permission)) redirect("/forbidden");
  return user;
}

/** Candidate pages: must be signed in as a CANDIDATE. Staff are sent to the admin portal. */
export async function requireCandidate(nextPath = "/candidate") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (user.role === "EMPLOYEE") redirect("/employee");
  if (user.role !== "CANDIDATE") redirect("/admin");
  return user;
}

export async function requireEmployee(nextPath = "/employee") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (user.role === "CANDIDATE") redirect("/candidate");
  if (user.role !== "EMPLOYEE") redirect("/admin");
  return user;
}

export async function assertEmployee() {
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE") throw new Error("Not authorised");
  return user;
}

export async function assertCandidate() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CANDIDATE") throw new Error("Not authorised");
  return user;
}

/** For server actions: never redirect-and-continue; throw so no mutation can run. */
export async function assertPermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, permission)) throw new Error("Not authorised");
  return user;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
