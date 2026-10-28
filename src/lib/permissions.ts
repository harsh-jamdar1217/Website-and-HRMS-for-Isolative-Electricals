import type { Role } from "./status";

/**
 * Role -> permission matrix. Enforced on the server (pages AND actions); hiding a button is never the control.
 * HR deliberately has no enquiry/client access: least privilege. HR owns recruitment; ADMIN owns everything.
 */
export const PERMISSIONS = [
  "admin:access",
  "enquiry:view",
  "enquiry:manage",
  "client:view",
  "email:view",
  "email:retry",
  "audit:view",
  "vacancy:manage",
  "candidate:view",
  "candidate:manage", // change application status, review documents
  "candidate:documents", // download candidate documents (every download is audited)
  "employee:view",
  "meeting:view",
  "meeting:manage", // create, reschedule, cancel, send reminders
  "employee:manage", // convert a candidate, edit assignment, tick HR onboarding tasks, complete onboarding
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, Permission[]> = {
  CANDIDATE: [],
  EMPLOYEE: [],
  HR: ["admin:access", "vacancy:manage", "candidate:view", "candidate:manage", "candidate:documents", "employee:view", "employee:manage", "meeting:view", "meeting:manage"],
  ADMIN: [...PERMISSIONS],
};

export function can(role: string | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return (MATRIX[role as Role] ?? []).includes(permission);
}
