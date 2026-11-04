import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { clearUploads } from "./uploads";

describe("clearUploads (demo reset on a mounted disk)", () => {
  it("empties the folder but keeps the folder itself", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fg-clear-"));
    fs.writeFileSync(path.join(dir, "a.png"), "x");
    fs.mkdirSync(path.join(dir, "sub")); fs.writeFileSync(path.join(dir, "sub", "b.pdf"), "y");
    clearUploads(dir);
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it("never deletes the database file (or its -wal/-shm) if both share a folder", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fg-clear-"));
    const db = path.join(dir, "fieldgrant.sqlite");
    for (const f of [db, `${db}-wal`, `${db}-shm`, path.join(dir, "receipt.png")]) fs.writeFileSync(f, "x");
    clearUploads(dir, db);
    expect(fs.readdirSync(dir).sort()).toEqual(["fieldgrant.sqlite", "fieldgrant.sqlite-shm", "fieldgrant.sqlite-wal"]);
  });

  it("is a no-op when the folder does not exist", () => {
    expect(() => clearUploads(path.join(os.tmpdir(), "fg-does-not-exist-xyz"))).not.toThrow();
  });
});
