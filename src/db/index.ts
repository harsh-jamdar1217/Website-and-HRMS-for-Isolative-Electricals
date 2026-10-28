import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "./schema";

function dbFile(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  return path.resolve(process.cwd(), url.replace(/^file:/, ""));
}

// Reuse one connection across hot reloads in development.
const g = globalThis as unknown as { __sqlite?: Database.Database };

function connect(): Database.Database {
  const sqlite = new Database(dbFile());
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

export const sqlite = g.__sqlite ?? connect();
if (process.env.NODE_ENV !== "production") g.__sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export { schema };
