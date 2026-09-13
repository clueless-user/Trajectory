// Event log (event_log table): append-only behavioural substrate powering
// analytics and past-day plan reconstruction. Rows are never mutated or
// deleted; instrumentation calls are fire-and-forget. Timestamps are UTC ISO;
// local-day ranges are converted by callers.
import { getDatabase } from "./database";

export interface EventLogEntry {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  payload: string | null;
  created_at: string;
}

/**
 * Append-only behavioural record. Fire-and-forget by design: instrumentation
 * must never break or delay the user action it observes.
 */
export class EventLogRepository {
  async record(
    eventType: string,
    entityType: string,
    entityId?: string | null,
    payload?: Record<string, unknown>
  ): Promise<void> {
    const db = getDatabase();
    await db.execute(
      `INSERT INTO event_log (id, event_type, entity_type, entity_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [
        crypto.randomUUID(),
        eventType,
        entityType,
        entityId ?? null,
        payload ? JSON.stringify(payload) : null,
        new Date().toISOString(),
      ]
    );
  }

  async getRecent(limit = 50): Promise<EventLogEntry[]> {
    const db = getDatabase();
    return await db.select<EventLogEntry>(
      `SELECT * FROM event_log ORDER BY created_at DESC LIMIT ?;`,
      [limit]
    );
  }

  async getByEntity(entityId: string): Promise<EventLogEntry[]> {
    const db = getDatabase();
    return await db.select<EventLogEntry>(
      `SELECT * FROM event_log WHERE entity_id = ? ORDER BY created_at ASC;`,
      [entityId]
    );
  }

  // Phase 2B read model: bounded analytics queries. Ranges are UTC ISO
  // instants (callers convert local days via src/domain/time/date.ts); the
  // created_at index keeps these date-bounded, never full scans.
  async getByDateRange(
    startIso: string,
    endIso: string,
    opts?: { eventTypes?: string[] }
  ): Promise<EventLogEntry[]> {
    const db = getDatabase();
    const types = opts?.eventTypes;
    if (types && types.length > 0) {
      const placeholders = types.map(() => "?").join(", ");
      return await db.select<EventLogEntry>(
        `SELECT * FROM event_log
         WHERE created_at >= ? AND created_at < ? AND event_type IN (${placeholders})
         ORDER BY created_at ASC;`,
        [startIso, endIso, ...types]
      );
    }
    return await db.select<EventLogEntry>(
      `SELECT * FROM event_log WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC;`,
      [startIso, endIso]
    );
  }

  async getByType(eventType: string, limit = 500): Promise<EventLogEntry[]> {
    const db = getDatabase();
    return await db.select<EventLogEntry>(
      `SELECT * FROM event_log WHERE event_type = ? ORDER BY created_at DESC LIMIT ?;`,
      [eventType, limit]
    );
  }

  /**
   * Latest planning.day_snapshot per local date within [startIso, endIso).
   * Bounded query + in-memory dedupe; callers use these to reconstruct the
   * plan of record for past days (see docs/SEMANTICS.md §9.2).
   */
  async getLatestSnapshotsForRange(startIso: string, endIso: string): Promise<EventLogEntry[]> {
    const rows = await this.getByDateRange(startIso, endIso, {
      eventTypes: ["planning.day_snapshot"],
    });
    const latestByDate = new Map<string, EventLogEntry>();
    for (const row of rows) {
      let date: string | undefined;
      try {
        const payload = JSON.parse(row.payload ?? "{}");
        date = typeof payload.date === "string" ? payload.date : undefined;
      } catch {
        date = undefined;
      }
      if (date) {
        // rows are ASC by created_at; overwrite keeps the newest per date
        latestByDate.set(date, row);
      }
    }
    return [...latestByDate.values()];
  }
}
