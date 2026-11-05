import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { migrate, openDb } from "../src/lib/db";

describe("migration 003 (foundations) upgrades an existing database", () => {
  it("promotes free-text funder names to foundation rows, links grants and keeps the old FY model", () => {
    const db = openDb(":memory:");
    db.exec("CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))");
    for (const f of ["001_init.sql", "002_fiscal_year.sql"]) {
      db.exec(fs.readFileSync(path.resolve("db", "migrations", f), "utf8"));
      db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(f);
    }
    // A database created before foundations existed.
    db.prepare("UPDATE foundation_settings SET funder_fy_model='APRIL_MARCH' WHERE id=1").run();
    db.prepare("INSERT INTO ngo (name, sector, country_label, country_code, paypal_email, contact_name) VALUES ('N','S','C','IN','n@example.test','x')").run();
    const ins = db.prepare("INSERT INTO grant_award (ngo_id, name, foundation_name, total_cents, start_date, end_date, spend_cap_cents) VALUES (1,?,?,100,'2026-01-01','2026-12-31',100)");
    ins.run("G1", "Old Funder A");
    ins.run("G2", "Old Funder B");
    ins.run("G3", "Old Funder A");

    expect(migrate(db)).toEqual(["003_foundations.sql", "004_compliance.sql", "005_reports.sql", "006_app_meta.sql"]);

    const f = db.prepare("SELECT id, name, fy_model FROM foundation ORDER BY id").all() as { id: number; name: string; fy_model: string }[];
    expect(f.map((x) => x.name).sort()).toEqual(["Old Funder A", "Old Funder B"]);
    expect(f.every((x) => x.fy_model === "APRIL_MARCH")).toBe(true);
    const linked = db.prepare("SELECT g.name, f.name AS funder FROM grant_award g JOIN foundation f ON f.id=g.foundation_id ORDER BY g.id").all();
    expect(linked).toEqual([{ name: "G1", funder: "Old Funder A" }, { name: "G2", funder: "Old Funder B" }, { name: "G3", funder: "Old Funder A" }]);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name='foundation_settings'").get()).toBeUndefined();

    // Migration 004: existing grants get NO covenants and existing NGOs an empty vault, so nothing that was payable becomes blocked.
    expect(db.prepare("SELECT DISTINCT covenants c FROM grant_award").all()).toEqual([{ c: "[]" }]);
    expect(db.prepare("SELECT compliance_vault v FROM ngo").get()).toEqual({ v: "[]" });
    expect(db.prepare("SELECT DISTINCT country_code c FROM foundation").all()).toEqual([{ c: "US" }]);
  });

  it("is a no-op the second time", () => {
    const db = openDb(":memory:");
    migrate(db);
    expect(migrate(db)).toEqual([]);
  });
});
