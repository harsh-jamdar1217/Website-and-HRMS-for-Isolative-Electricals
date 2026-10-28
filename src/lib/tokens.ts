import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Create a single-use token. Older unused tokens of the same purpose are invalidated, so only the newest link works. */
export function createToken(userId: string, purpose: string, ttlHours = 24): { raw: string; id: string } {
  const raw = randomBytes(32).toString("base64url");
  return db.transaction((tx) => {
    tx.update(schema.verificationTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(schema.verificationTokens.userId, userId), eq(schema.verificationTokens.purpose, purpose), isNull(schema.verificationTokens.usedAt)))
      .run();
    const row = tx
      .insert(schema.verificationTokens)
      .values({ userId, purpose, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlHours * 3600_000) })
      .returning({ id: schema.verificationTokens.id })
      .get();
    return { raw, id: row.id };
  });
}

/** Atomically consume a token. Returns the user id, or null if unknown, expired or already used. */
export function consumeToken(raw: string, purpose: string): string | null {
  if (!raw || raw.length > 200) return null;
  const row = db
    .update(schema.verificationTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.verificationTokens.tokenHash, sha256(raw)),
        eq(schema.verificationTokens.purpose, purpose),
        isNull(schema.verificationTokens.usedAt),
        gt(schema.verificationTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: schema.verificationTokens.userId })
    .get();
  return row?.userId ?? null;
}
