import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { env } from "./env";
import { seedDatabase, seedEmailsFromEnv } from "./seed";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "db", "migrations");

/** Open the SQLite file (creating its folder) with FK enforcement and WAL. */
export function openDb(file = env.databasePath()): Database.Database {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

let shared: Database.Database | null = null;
/** Process-wide handle for API routes. */
export function getDb(): Database.Database {
  if (!shared) {
    shared = openDb();
    migrate(shared);
    // Fresh disk (e.g. first boot on Render): seed so the demo is never an empty screen.
    if ((shared.prepare("SELECT COUNT(*) c FROM ngo").get() as { c: number }).c === 0) seedDatabase(shared, seedEmailsFromEnv());
  }
  return shared;
}

/** Apply db/migrations/NNN_*.sql files not yet recorded in schema_migrations. */
export function migrate(db: Database.Database): string[] {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))",
  );
  const done = new Set(db.prepare("SELECT name FROM schema_migrations").all().map((r) => (r as { name: string }).name));
  const applied: string[] = [];
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(f);
    })();
    applied.push(f);
  }
  return applied;
}
