import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { env } from "./env";

describe("env defaults", () => {
  const saved = { db: process.env.DATABASE_PATH, up: process.env.UPLOADS_DIR, max: process.env.MAX_UPLOAD_BYTES };
  afterEach(() => {
    for (const [k, v] of [["DATABASE_PATH", saved.db], ["UPLOADS_DIR", saved.up], ["MAX_UPLOAD_BYTES", saved.max]] as const) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });

  it("falls back to ~/.fieldgrant when unset", () => {
    delete process.env.DATABASE_PATH; delete process.env.UPLOADS_DIR;
    expect(env.databasePath()).toBe(path.join(os.homedir(), ".fieldgrant", "fieldgrant.sqlite"));
    expect(env.uploadsDir()).toBe(path.join(os.homedir(), ".fieldgrant", "uploads"));
  });
  it("treats BLANK values (as copied from .env.example) the same as unset", () => {
    process.env.DATABASE_PATH = ""; process.env.UPLOADS_DIR = ""; process.env.MAX_UPLOAD_BYTES = "";
    expect(env.databasePath()).toBe(path.join(os.homedir(), ".fieldgrant", "fieldgrant.sqlite"));
    expect(env.uploadsDir()).toBe(path.join(os.homedir(), ".fieldgrant", "uploads"));
    expect(env.maxUploadBytes()).toBe(8 * 1024 * 1024);
  });
  it("honours an explicit path", () => {
    process.env.DATABASE_PATH = path.join(os.tmpdir(), "x.sqlite");
    expect(env.databasePath()).toBe(path.join(os.tmpdir(), "x.sqlite"));
  });
});

describe("persistent storage on a mounted disk", () => {
  it("uses absolute DATABASE_PATH and UPLOADS_DIR exactly as given (e.g. Render's /var/data)", () => {
    process.env.DATABASE_PATH = path.resolve("/var/data/fieldgrant.sqlite");
    process.env.UPLOADS_DIR = path.resolve("/var/data/uploads");
    expect(env.databasePath()).toBe(path.resolve("/var/data/fieldgrant.sqlite"));
    expect(env.uploadsDir()).toBe(path.resolve("/var/data/uploads"));
    delete process.env.DATABASE_PATH; delete process.env.UPLOADS_DIR;
  });
});

describe("requireEnv", () => {
  it("trims whitespace pasted around a key", async () => {
    const { requireEnv } = await import("./env");
    process.env.FG_TEST_KEY = "  abc123 \t";
    expect(requireEnv("FG_TEST_KEY")).toBe("abc123");
    delete process.env.FG_TEST_KEY;
  });
});
