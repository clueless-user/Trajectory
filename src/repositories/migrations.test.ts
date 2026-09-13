import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryDatabase, setDatabase, getDatabase } from "./database";

describe("migration 005 (goal parked_until)", () => {
  beforeEach(async () => {
    setDatabase(await createInMemoryDatabase());
  });

  it("fresh install: all migrations apply in order and parked_until exists", async () => {
    const versions = await getDatabase().select<{ version: number }>(
      "SELECT version FROM _migrations ORDER BY version;"
    );
    expect(versions.map((v) => v.version)).toEqual([1, 2, 3, 4, 5]);
    const cols = await getDatabase().select<{ name: string }>(
      "PRAGMA table_info(goals);"
    );
    expect(cols.map((c) => c.name)).toContain("parked_until");
  });

  it("v4→v5 upgrade: applying 005 to a database without the column adds it once", async () => {
    // Simulate a v4 database: drop the column's effect by recreating a goals
    // table without parked_until (the in-memory DB already ran 005 at boot).
    const db = getDatabase();
    await db.execute("DROP TABLE goals;");
    await db.execute(`CREATE TABLE goals (
      id TEXT PRIMARY KEY,
      area_id TEXT REFERENCES areas(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      target_date TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','achieved','paused','abandoned')),
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`);
    // remove the recorded version so the runner treats 005 as pending
    await db.execute("DELETE FROM _migrations WHERE version = 5;");

    const { runMigrations } = await import("./database");
    await runMigrations(db); // v5 upgrade

    const cols = await db.select<{ name: string }>("PRAGMA table_info(goals);");
    expect(cols.map((c) => c.name)).toContain("parked_until");
    const versions = await db.select<{ version: number }>(
      "SELECT version FROM _migrations ORDER BY version;"
    );
    expect(versions.map((v) => v.version)).toEqual([1, 2, 3, 4, 5]);
  });

  it("idempotent re-run: a crash between ALTER and version-record converges", async () => {
    const db = getDatabase();
    // Simulate the crash window: column already added, version not recorded.
    await db.execute("DELETE FROM _migrations WHERE version = 5;");
    const { runMigrations } = await import("./database");
    // Must NOT throw "duplicate column" — the runner converges.
    await expect(runMigrations(db)).resolves.toBeUndefined();
    const versions = await db.select<{ version: number }>(
      "SELECT version FROM _migrations ORDER BY version;"
    );
    expect(versions.map((v) => v.version)).toEqual([1, 2, 3, 4, 5]);
  });

  it("parking round-trip: status 'paused' satisfies the CHECK, parked_until persists", async () => {
    const db = getDatabase();
    await db.execute(
      `INSERT INTO goals (id, title, status, parked_until, created_at, updated_at)
       VALUES ('g1', 'Parked goal', 'paused', '2026-09-14', '2026-09-01T00:00:00Z', '2026-09-14T00:00:00Z');`
    );
    const rows = await db.select<{ status: string; parked_until: string }>(
      "SELECT status, parked_until FROM goals WHERE id = 'g1';"
    );
    expect(rows[0]).toEqual({ status: "paused", parked_until: "2026-09-14" });
  });
});
