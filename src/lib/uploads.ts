// File intake: PDF/PNG/JPG only, size-limited, stored OUTSIDE the public web root (UPLOADS_DIR, not /public).
// WHY magic bytes: the browser-supplied MIME type and file name are attacker-controlled; we trust neither,
// and generate our own random file name so a path can never be steered.
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "./env";

export type StoredFile = { path: string; sha256: string; mediaType: "application/pdf" | "image/png" | "image/jpeg"; bytes: number };
export class UploadError extends Error {}

/**
 * Empties the uploads folder WITHOUT removing the folder itself (on Render it can sit on a mounted disk, which cannot be removed)
 * and without deleting anything that is, or contains, the database file if both were pointed at the same place.
 */
export function clearUploads(dir: string, protect?: string): void {
  if (!fs.existsSync(dir)) return;
  const guard = protect ? path.resolve(protect) : null;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (guard && (p === guard || p.startsWith(guard + "-") || guard.startsWith(p + path.sep))) continue; // keeps the .sqlite and its -wal/-shm files
    fs.rmSync(p, { recursive: true, force: true });
  }
}

function sniff(buf: Buffer): { mediaType: StoredFile["mediaType"]; ext: string } | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return { mediaType: "application/pdf", ext: ".pdf" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mediaType: "image/png", ext: ".png" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mediaType: "image/jpeg", ext: ".jpg" };
  return null;
}

export function storeUpload(buf: Buffer, label: string): StoredFile {
  const max = env.maxUploadBytes();
  if (buf.length === 0) throw new UploadError(`The ${label} file is empty.`);
  if (buf.length > max) throw new UploadError(`The ${label} file is larger than the ${(max / 1024 / 1024).toFixed(0)} MB limit.`);
  const kind = sniff(buf);
  if (!kind) throw new UploadError(`The ${label} must be a PDF, PNG or JPG file.`);
  const dir = env.uploadsDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${randomUUID()}${kind.ext}`);
  fs.writeFileSync(file, buf);
  return { path: file, sha256: createHash("sha256").update(buf).digest("hex"), mediaType: kind.mediaType, bytes: buf.length };
}
