import bcrypt from "bcryptjs";

const COST = 12;
// Pre-computed hash used to equalise timing when the account does not exist (avoids user enumeration).
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", COST);

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  return bcrypt.compare(plain, hash ?? DUMMY_HASH).then((ok) => ok && !!hash);
}

/** Minimum policy: 10+ characters with letters and digits. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Include both letters and numbers.";
  return null;
}
