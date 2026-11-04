// Secrets live only in environment variables. Never log their values.
import os from "node:os";
import path from "node:path";

/** Load .env for standalone scripts (Next.js loads it itself). Node 20.12+/24 built-in. */
export function loadEnv(): void {
  try {
    process.loadEnvFile(path.resolve(process.cwd(), ".env"));
  } catch {
    // no .env file: fine, variables may come from the real environment
  }
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name} (see .env.example)`);
  return v;
}

// WHY outside the project folder: `next dev` watches the repo, and SQLite touches its -wal/-shm files even on reads,
// which made the dev server recompile and reload the page in a loop. Override with DATABASE_PATH / UPLOADS_DIR.
const DATA_HOME = path.join(os.homedir(), ".fieldgrant");

export const env = {
  databasePath: () => path.resolve(process.env.DATABASE_PATH || path.join(DATA_HOME, "fieldgrant.sqlite")),
  uploadsDir: () => path.resolve(process.env.UPLOADS_DIR || path.join(DATA_HOME, "uploads")),
  maxUploadBytes: () => Number(process.env.MAX_UPLOAD_BYTES || 8 * 1024 * 1024),
};
