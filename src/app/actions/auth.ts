"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { audit } from "@/lib/audit";
import { clientIp, createSession, destroySession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { fieldErrors, loginSchema, type FieldErrors } from "@/lib/validation";

export type LoginState = { errors?: FieldErrors; formError?: string; email?: string };

/** Only allow same-site relative redirects (prevents open-redirect abuse via ?next=). */
function safeNext(next: string | null, fallback: string): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), email: String(formData.get("email") ?? "") };
  const { email, password } = parsed.data;

  // 5 attempts per 15 minutes per (IP, email): slows password guessing.
  const rl = rateLimit(`login:${await clientIp()}:${email}`, 5, 15 * 60_000);
  if (!rl.ok) return { formError: `Too many sign-in attempts. Try again in ${Math.ceil(rl.retryAfterSec / 60)} minute(s).`, email };

  const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  const ok = await verifyPassword(password, user?.passwordHash);
  // One generic message for unknown user, wrong password and deactivated account: no account enumeration.
  if (!user || !ok || !user.isActive) return { formError: "Email or password is incorrect.", email };

  await createSession(user.id);
  audit({ actorId: user.id, action: "auth.login", entityType: "user", entityId: user.id });
  const home = user.role === "CANDIDATE" ? "/candidate" : user.role === "EMPLOYEE" ? "/employee" : "/admin";
  const requested = String(formData.get("next") ?? "");
  // a candidate must never be sent into /admin (or staff into /candidate) by a stale ?next=
  const allowed = user.role === "CANDIDATE" ? requested.startsWith("/candidate") || requested.startsWith("/careers")
    : user.role === "EMPLOYEE" ? requested.startsWith("/employee")
    : !requested.startsWith("/candidate") && !requested.startsWith("/employee");
  redirect(safeNext(allowed ? requested : null, home));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
