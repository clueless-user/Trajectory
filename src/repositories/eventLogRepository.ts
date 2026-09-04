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
}
