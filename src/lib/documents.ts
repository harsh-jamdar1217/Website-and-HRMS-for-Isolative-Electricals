import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "./audit";
import { CANDIDATE_DOC_TYPES, DOCUMENT_TYPES, type DocumentType } from "./status";

export const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ACTIVE_OTHER = 3;
export class DocumentError extends Error {}

/** Private storage: outside `public/`, never served by a URL. Files are only reachable through the authorised download route. */
export function storageDir(): string {
  const dir = path.resolve(process.cwd(), process.env.DOCUMENT_DIR ?? "storage/documents");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Identify the file from its CONTENT. The browser-supplied type and the file extension are ignored. */
export function sniff(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  return null;
}

/** Display-only name. It is never used to build a path. */
export function sanitizeName(name: string, ext: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const stem = base.replace(/\.[^.]*$/, "").replace(/[^A-Za-z0-9 ._()-]+/g, "").replace(/\.{2,}/g, ".").trim().slice(0, 80) || "document";
  return `${stem}.${ext}`;
}

/**
 * Malware-scan extension point. Nothing is scanned in this build, so files are stored as NOT_SCANNED and the
 * UI says so. To enable: stream the buffer to ClamAV (clamd INSTREAM) here and return "CLEAN" or "INFECTED".
 */
export async function scanBuffer(_buf: Buffer): Promise<"NOT_SCANNED" | "CLEAN" | "INFECTED"> {
  return "NOT_SCANNED";
}

export async function saveDocument(input: { applicationId: string; type: string; file: File; actorId: string; allowedTypes?: Record<string, string> }) {
  if (!(input.type in (input.allowedTypes ?? CANDIDATE_DOC_TYPES))) throw new DocumentError("Choose a document type.");
  const type = input.type as DocumentType;
  const { file } = input;
  if (!file || file.size === 0) throw new DocumentError("Choose a file to upload.");
  if (file.size > MAX_BYTES) throw new DocumentError("The file is larger than 5 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new DocumentError("The file is larger than 5 MB.");
  const kind = sniff(buf);
  if (!kind) throw new DocumentError("Only PDF, JPG and PNG files are accepted.");

  if (type === "OTHER") {
    const n = db.select().from(schema.documents).where(and(eq(schema.documents.applicationId, input.applicationId), eq(schema.documents.type, "OTHER"), isNull(schema.documents.supersededAt))).all().length;
    if (n >= MAX_ACTIVE_OTHER) throw new DocumentError(`You can keep at most ${MAX_ACTIVE_OTHER} supporting documents.`);
  }
  const scan = await scanBuffer(buf);
  if (scan === "INFECTED") throw new DocumentError("This file was rejected by the security scan.");

  const storageKey = randomUUID();
  const full = path.join(storageDir(), storageKey);
  await writeFile(full, buf, { mode: 0o600, flag: "wx" });
  try {
    return db.transaction((tx) => {
      if (type !== "OTHER") {
        tx.update(schema.documents).set({ supersededAt: new Date() })
          .where(and(eq(schema.documents.applicationId, input.applicationId), eq(schema.documents.type, type), isNull(schema.documents.supersededAt))).run();
      }
      const doc = tx.insert(schema.documents).values({
        applicationId: input.applicationId, type, originalName: sanitizeName(file.name, kind.ext), storageKey, mimeType: kind.mime,
        sizeBytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), scanStatus: scan,
      }).returning().get();
      tx.insert(schema.auditLogs).values({ actorId: input.actorId, action: "document.uploaded", entityType: "application", entityId: input.applicationId, details: JSON.stringify({ documentId: doc.id, type }) }).run();
      return doc;
    });
  } catch (e) {
    await unlink(full).catch(() => {}); // do not leave an orphan file behind
    throw e;
  }
}

export async function readStored(storageKey: string): Promise<Buffer> {
  if (!/^[0-9a-f-]{36}$/.test(storageKey)) throw new Error("Invalid storage key");
  return readFile(path.join(storageDir(), storageKey));
}

export function auditDownload(actorId: string, doc: { id: string; applicationId: string; type: string }) {
  audit({ actorId, action: "document.downloaded", entityType: "application", entityId: doc.applicationId, details: { documentId: doc.id, type: doc.type } });
}
