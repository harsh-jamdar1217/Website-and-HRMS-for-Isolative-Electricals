import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid misreading

/** Random, non-sequential reference such as APP-2026-7K3M9Q (cannot be enumerated). */
export function makeReference(prefix: string, now = new Date()): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefix}-${now.getFullYear()}-${s}`;
}

export function slugify(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "vacancy";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += ALPHABET[randomInt(ALPHABET.length)].toLowerCase();
  return `${base}-${suffix}`;
}
