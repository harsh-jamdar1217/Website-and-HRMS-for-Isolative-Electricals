import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const sqlite = new Database(path.resolve(process.cwd(), url.replace(/^file:/, "")));
sqlite.pragma("foreign_keys = ON");
migrate(drizzle(sqlite), { migrationsFolder: "./drizzle" });
console.log("Migrations applied.");
sqlite.close();
