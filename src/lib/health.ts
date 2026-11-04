import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { env } from "./env";

export type Health = {
  status: "healthy" | "degraded";
  checkedAt: string;
  runtime: { platform: "render" | "local"; nodeEnv: string; node: string; uptimeSec: number };
  database: { ok: boolean; writeLatencyMs: number | null; error?: string };
  uploads: { ok: boolean; writable: boolean; error?: string };
  /** `persistent` is true only when the database and uploads both live on the mounted disk (Render: /var/data). */
  disk: { mountPath: string | null; persistent: boolean };
};

const MOUNT = "/var/data";
const under = (p: string, dir: string) => path.resolve(p) === dir || path.resolve(p).startsWith(dir + path.sep);

/**
 * Real probes, nothing assumed: a timed write+delete transaction on the SQLite file (so the latency is that of the disk it
 * sits on), and a create-and-remove of a marker file in the uploads folder. No secrets and no file paths are returned.
 */
export function checkHealth(db: Database.Database): Health {
  const database: Health["database"] = { ok: false, writeLatencyMs: null };
  try {
    const t0 = performance.now();
    db.transaction(() => {
      db.exec("CREATE TABLE IF NOT EXISTS _health_probe (id INTEGER PRIMARY KEY, at TEXT)");
      const id = Number(db.prepare("INSERT INTO _health_probe (at) VALUES (datetime('now'))").run().lastInsertRowid);
      db.prepare("DELETE FROM _health_probe WHERE id=?").run(id);
    })();
    database.ok = true;
    database.writeLatencyMs = Math.round((performance.now() - t0) * 100) / 100;
  } catch (e) {
    database.error = (e as Error).message.slice(0, 120);
  }

  const uploads: Health["uploads"] = { ok: false, writable: false };
  try {
    const dir = env.uploadsDir();
    fs.mkdirSync(dir, { recursive: true });
    const marker = path.join(dir, `.health-${process.pid}`);
    fs.writeFileSync(marker, "ok");
    fs.rmSync(marker, { force: true });
    uploads.ok = true; uploads.writable = true;
  } catch (e) {
    uploads.error = (e as Error).message.slice(0, 120);
  }

  const persistent = under(env.databasePath(), MOUNT) && under(env.uploadsDir(), MOUNT) && fs.existsSync(MOUNT);
  return {
    status: database.ok && uploads.ok ? "healthy" : "degraded",
    checkedAt: new Date().toISOString(),
    runtime: { platform: process.env.RENDER === "true" ? "render" : "local", nodeEnv: process.env.NODE_ENV ?? "development", node: process.version, uptimeSec: Math.round(process.uptime()) },
    database, uploads,
    disk: { mountPath: persistent ? MOUNT : null, persistent },
  };
}
