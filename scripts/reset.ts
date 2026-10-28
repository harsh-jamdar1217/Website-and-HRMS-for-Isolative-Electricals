// Deletes the local dev database, re-applies migrations and re-seeds demo data.
import { rmSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const file = path.resolve(process.cwd(), url.replace(/^file:/, ""));
for (const f of [file, `${file}-wal`, `${file}-shm`]) rmSync(f, { force: true });
execSync("npm run setup", { stdio: "inherit" });
