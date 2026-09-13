import initSqlJs, { Database as SqlJsDatabase } from "sql.js";

export interface QueryResult {
  rowsAffected: number;
  lastInsertId?: number;
}

export interface DatabaseAdapter {
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  select<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}

// In-memory SQLite adapter powered by sql.js for tests and browser development
export class SqlJsAdapter implements DatabaseAdapter {
  private db: SqlJsDatabase;

  constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
    try {
      this.db.run(sql, params as (number | string | null | Uint8Array)[]);
      const rowsAffected = this.db.getRowsModified();
      return { rowsAffected };
    } catch (error) {
      console.error("SQL Execute Error:", sql, params, error);
      throw error;
    }
  }

  async select<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params as (number | string | null | Uint8Array)[]);
      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as unknown as T);
      }
      stmt.free();
      return results;
    } catch (error) {
      console.error("SQL Select Error:", sql, params, error);
      throw error;
    }
  }
}

// Native Tauri SQLite Adapter
export class TauriSqlAdapter implements DatabaseAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tauriDb: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(tauriDb: any) {
    this.tauriDb = tauriDb;
  }

  async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
    const result = await this.tauriDb.execute(sql, params);
    return {
      rowsAffected: result.rowsAffected ?? 0,
      lastInsertId: result.lastInsertId,
    };
  }

  async select<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return await this.tauriDb.select(sql, params);
  }
}

// Global active database instance
let activeDb: DatabaseAdapter | null = null;

export function getDatabase(): DatabaseAdapter {
  if (!activeDb) {
    throw new Error("Database has not been initialized. Call initializeDatabase() first.");
  }
  return activeDb;
}

export function setDatabase(db: DatabaseAdapter) {
  activeDb = db;
  // Manual adapter control (tests) supersedes any pending/cached init.
  initPromise = null;
}

// SQL Migration Scripts
const MIGRATION_001 = `
CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS areas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    area_id TEXT REFERENCES areas(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    target_date TEXT,
    status TEXT NOT NULL CHECK(status IN ('active', 'achieved', 'paused', 'abandoned')) DEFAULT 'active',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goals_area ON goals(area_id);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
    area_id TEXT REFERENCES areas(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK(status IN ('active', 'completed', 'on_hold', 'archived')) DEFAULT 'active',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_goal ON projects(goal_id);
CREATE INDEX IF NOT EXISTS idx_projects_area ON projects(area_id);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    importance TEXT NOT NULL CHECK(importance IN ('critical', 'important', 'optional')) DEFAULT 'important',
    cognitive_demand TEXT NOT NULL CHECK(cognitive_demand IN ('deep', 'medium', 'shallow')) DEFAULT 'medium',
    status TEXT NOT NULL CHECK(status IN ('inbox', 'planned', 'in_progress', 'completed', 'cancelled', 'deferred')) DEFAULT 'inbox',
    estimated_minutes INTEGER NOT NULL DEFAULT 30,
    actual_minutes INTEGER NOT NULL DEFAULT 0,
    scheduled_date TEXT,
    due_date TEXT,
    completed_at TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_status_date ON tasks(status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);

CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 0,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_actions_task ON actions(task_id);

CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    area_id TEXT REFERENCES areas(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    unit TEXT NOT NULL DEFAULT 'minutes',
    normal_target REAL NOT NULL,
    minimum_target REAL NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS habit_logs (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    value REAL NOT NULL DEFAULT 0,
    target_met_status TEXT NOT NULL CHECK(target_met_status IN ('none', 'minimum', 'normal', 'exceeded')),
    notes TEXT,
    logged_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_logs_unique_day ON habit_logs(habit_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date);

CREATE TABLE IF NOT EXISTS work_sessions (
    id TEXT PRIMARY KEY,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    interruption_count INTEGER NOT NULL DEFAULT 0,
    completed_state TEXT NOT NULL CHECK(completed_state IN ('finished', 'interrupted', 'paused')),
    notes TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_work_sessions_task ON work_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_start ON work_sessions(start_time);

CREATE TABLE IF NOT EXISTS daily_states (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    energy INTEGER CHECK(energy BETWEEN 1 AND 10),
    clarity INTEGER CHECK(clarity BETWEEN 1 AND 10),
    stress INTEGER CHECK(stress BETWEEN 1 AND 10),
    social_battery INTEGER CHECK(social_battery BETWEEN 1 AND 10),
    notes TEXT,
    logged_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_daily_states_date ON daily_states(date);

CREATE TABLE IF NOT EXISTS daily_reviews (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    completed_task_count INTEGER NOT NULL DEFAULT 0,
    total_work_minutes INTEGER NOT NULL DEFAULT 0,
    energy_drains TEXT,
    energy_boosts TEXT,
    tomorrow_objective TEXT,
    reflection_notes TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rabbit_holes (
    id TEXT PRIMARY KEY,
    active_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    active_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    raw_text TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('captured', 'converted_task', 'converted_project', 'converted_idea', 'archived')) DEFAULT 'captured',
    converted_id TEXT,
    created_at TEXT NOT NULL,
    converted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_rabbit_holes_status ON rabbit_holes(status);

CREATE TABLE IF NOT EXISTS brain_dumps (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
`;

// Behavioural instrumentation: append-only record of important lifecycle
// events (task/session/habit/review/rabbit-hole transitions).
const MIGRATION_002 = `
CREATE TABLE IF NOT EXISTS event_log (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    payload TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_log_created ON event_log(created_at);
CREATE INDEX IF NOT EXISTS idx_event_log_entity ON event_log(entity_id);
`;

// Per-day planning state: the primary objective and available capacity.
// Single row per local day — the persistence behind the Now screen.
const MIGRATION_003 = `
CREATE TABLE IF NOT EXISTS planning_state (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    primary_objective TEXT,
    available_minutes INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_planning_state_date ON planning_state(date);
`;

// Daily-state integrity: one row per local day. A StrictMode double-boot
// could race the seed/insert and create duplicate rows for the same date;
// this migration repairs that explicitly (keeping the latest logged_at per
// date) BEFORE enforcing uniqueness. Never silent: if rows cannot be
// de-duplicated the index creation fails loudly.
const MIGRATION_004 = `
DELETE FROM daily_states
WHERE logged_at < (SELECT MAX(ds.logged_at) FROM daily_states ds WHERE ds.date = daily_states.date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_states_unique_date ON daily_states(date);
`;

// Goal parking (Phase 2C): the local day a parked goal was parked on. The
// goals.status column already exists (001) with 'paused' in its CHECK, so
// only the timestamp column is new. Version-gated: runs once per database
// (ALTER TABLE ADD COLUMN has no IF NOT EXISTS in SQLite).
const MIGRATION_005 = `
ALTER TABLE goals ADD COLUMN parked_until TEXT;
`;

const MIGRATIONS: Readonly<Record<number, { version: number; name: string; statements: string }>> = {
  1: { version: 1, name: "001_initial_schema", statements: MIGRATION_001 },
  2: { version: 2, name: "002_event_log", statements: MIGRATION_002 },
  3: { version: 3, name: "003_planning_state", statements: MIGRATION_003 },
  4: { version: 4, name: "004_daily_states_unique_date", statements: MIGRATION_004 },
  5: { version: 5, name: "005_goal_parked_until", statements: MIGRATION_005 },
};

export async function runMigrations(db: DatabaseAdapter): Promise<void> {
  // Apply migrations in order, skipping versions already recorded. Each
  // migration is written idempotently (IF NOT EXISTS) so a crash between DDL
  // and recording the version still converges on the next run.
  // The bookkeeping table must exist before versions can be read; on a fresh
  // database migration 001 has not created it yet.
  await db.execute(`CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );`);

  const applied = new Set(
    (await db.select<{ version: number }>("SELECT version FROM _migrations;")).map(
      (row) => row.version
    )
  );

  for (const migration of Object.values(MIGRATIONS)) {
    if (applied.has(migration.version)) continue;

    const statements = migration.statements
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await db.execute(statement + ";");
    }

    await db.execute(
      "INSERT OR IGNORE INTO _migrations (version, name, applied_at) VALUES (?, ?, ?);",
      [migration.version, migration.name, new Date().toISOString()]
    );
  }

  // Seed default life areas & habits if empty
  await seedDefaultsIfEmpty(db);
}

async function seedDefaultsIfEmpty(db: DatabaseAdapter): Promise<void> {
  const areas = await db.select<{ count: number }>("SELECT COUNT(*) as count FROM areas;");
  if (areas[0]?.count === 0) {
    const now = new Date().toISOString();
    const defaultAreas = [
      { id: "11111111-1111-4111-8111-111111111111", name: "AI & Engineering", color: "#06b6d4", order: 0 },
      { id: "22222222-2222-4222-8222-222222222222", name: "Research & Systems", color: "#8b5cf6", order: 1 },
      { id: "33333333-3333-4333-8333-333333333333", name: "Health & Vitality", color: "#10b981", order: 2 },
      { id: "44444444-4444-4444-8444-444444444444", name: "Personal Operations", color: "#f59e0b", order: 3 },
    ];

    for (const a of defaultAreas) {
      await db.execute(
        "INSERT INTO areas (id, name, color, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);",
        [a.id, a.name, a.color, a.order, now, now]
      );
    }

    const defaultHabits = [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        area_id: "11111111-1111-4111-8111-111111111111",
        title: "Deep Work",
        unit: "minutes",
        normal: 180,
        minimum: 30,
        order: 0,
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        area_id: "33333333-3333-4333-8333-333333333333",
        title: "Exercise",
        unit: "minutes",
        normal: 45,
        minimum: 10,
        order: 1,
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        area_id: "33333333-3333-4333-8333-333333333333",
        title: "Meditation",
        unit: "minutes",
        normal: 60,
        minimum: 5,
        order: 2,
      },
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        area_id: "22222222-2222-4222-8222-222222222222",
        title: "Reading / Research",
        unit: "minutes",
        normal: 45,
        minimum: 15,
        order: 3,
      },
    ];

    for (const h of defaultHabits) {
      await db.execute(
        "INSERT INTO habits (id, area_id, title, unit, normal_target, minimum_target, order_index, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?);",
        [h.id, h.area_id, h.title, h.unit, h.normal, h.minimum, h.order, now, now]
      );
    }
  }
}

// Creates an in-memory database instance (ideal for tests and browser development)
export async function createInMemoryDatabase(): Promise<DatabaseAdapter> {
  const config: Record<string, unknown> = {};

  // If in Node/Vitest test runner (even under jsdom), load local wasm binary for speed and offline reliability
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const wasmPath = path.resolve(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm");
      if (fs.existsSync(wasmPath)) {
        config.wasmBinary = fs.readFileSync(wasmPath);
      }
    } catch (e) {
      console.warn("Could not read local wasm binary:", e);
    }
  }

  const SQL = await initSqlJs(config);
  const db = new SQL.Database();
  const adapter = new SqlJsAdapter(db);
  await runMigrations(adapter);
  return adapter;
}

// Singleton initialization: React StrictMode (and any double boot) must share
// one initialization so migrations cannot race each other on the same database.
let initPromise: Promise<DatabaseAdapter> | null = null;

async function doInitializeDatabase(): Promise<DatabaseAdapter> {
  // Check if Tauri is present
  // @ts-expect-error window.__TAURI_INTERNALS__ is injected by Tauri
  const isTauri = typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);

  if (isTauri) {
    // Inside the native app there is no fallback: silently running on an
    // in-memory database would lose every piece of data on exit.
    const { default: Database } = await import("@tauri-apps/plugin-sql");
    const tauriDb = await Database.load("sqlite:trajectory.db");
    const adapter = new TauriSqlAdapter(tauriDb);
    await runMigrations(adapter);
    activeDb = adapter;
    return adapter;
  }

  // Fallback to in-memory sql.js (browser development and tests only)
  const adapter = await createInMemoryDatabase();
  activeDb = adapter;
  return adapter;
}

export function initializeDatabase(): Promise<DatabaseAdapter> {
  if (!initPromise) {
    initPromise = doInitializeDatabase();
  }
  return initPromise;
}
