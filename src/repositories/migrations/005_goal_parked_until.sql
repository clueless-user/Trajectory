-- Phase 2C: goal parking. Reference copy only — the runtime truth is the
-- inline MIGRATION_005 in src/repositories/database.ts. Version-gated by the
-- runner (ALTER TABLE ADD COLUMN has no IF NOT EXISTS in SQLite).
ALTER TABLE goals ADD COLUMN parked_until TEXT;
