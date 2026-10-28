// TEST HELPER (development only): prints a fresh email-verification token for a user so end-to-end tests
// can complete the verification step without a real mailbox. Never ships to production use.
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { createToken } from "../src/lib/tokens";

const email = process.argv[2];
const u = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
if (!u) { console.error("no such user"); process.exit(1); }
console.log(createToken(u.id, "EMAIL_VERIFY").raw);
