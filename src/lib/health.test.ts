import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { healthLabel } from "../components/HealthBadge";
import { openDb, migrate } from "./db";
import { checkHealth } from "./health";

describe("health probe", () => {
  it("reports a timed database write and a writable uploads folder", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fg-health-"));
    process.env.UPLOADS_DIR = path.join(dir, "uploads");
    const db = openDb(":memory:"); migrate(db);
    const h = checkHealth(db);
    expect(h.status).toBe("healthy");
    expect(h.database.ok).toBe(true);
    expect(h.database.writeLatencyMs).toBeGreaterThanOrEqual(0);
    expect(h.uploads.writable).toBe(true);
    expect(fs.readdirSync(process.env.UPLOADS_DIR)).toEqual([]); // the probe cleans up after itself
  });

  it("is degraded when the uploads folder cannot be created", () => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fg-health-")), "file");
    fs.writeFileSync(f, "x");
    process.env.UPLOADS_DIR = path.join(f, "nested"); // a path below a regular file can never be created
    const db = openDb(":memory:"); migrate(db);
    expect(checkHealth(db).status).toBe("degraded");
  });

  it("never claims Render or a mounted disk it does not have", () => {
    const base = { status: "healthy" as const, runtime: { platform: "local" as const }, database: { writeLatencyMs: 1 }, disk: { mountPath: null, persistent: false } };
    expect(healthLabel(base, false).text).toMatch(/^Local/);
    expect(healthLabel({ ...base, runtime: { platform: "render" } }, false).text).toMatch(/no persistent disk/);
    expect(healthLabel({ ...base, runtime: { platform: "render" }, disk: { mountPath: "/var/data", persistent: true } }, false).text).toBe("Render: Healthy (/var/data disk mounted)");
  });
});
