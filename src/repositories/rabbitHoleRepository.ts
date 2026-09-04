import { getDatabase } from "./database";
import { EventLogRepository } from "./eventLogRepository";
import { RabbitHole, RabbitHoleStatus } from "../domain/models/types";

export class RabbitHoleRepository {
  // Rabbit holes are written directly from components (no store layer), so
  // their lifecycle instrumentation lives at this write boundary.
  private eventLog = new EventLogRepository();

  async getAllRabbitHoles(status?: RabbitHoleStatus): Promise<RabbitHole[]> {
    const db = getDatabase();
    if (status) {
      return await db.select<RabbitHole>(
        "SELECT * FROM rabbit_holes WHERE status = ? ORDER BY created_at DESC;",
        [status]
      );
    }
    return await db.select<RabbitHole>(
      "SELECT * FROM rabbit_holes ORDER BY created_at DESC;"
    );
  }

  async createRabbitHole(params: {
    raw_text: string;
    active_task_id?: string | null;
    active_project_id?: string | null;
  }): Promise<RabbitHole> {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const record: RabbitHole = {
      id,
      active_task_id: params.active_task_id || null,
      active_project_id: params.active_project_id || null,
      raw_text: params.raw_text,
      status: "captured",
      converted_id: null,
      created_at: now,
      converted_at: null,
    };

    await db.execute(
      `INSERT INTO rabbit_holes (id, active_task_id, active_project_id, raw_text, status, converted_id, created_at, converted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        record.id,
        record.active_task_id,
        record.active_project_id,
        record.raw_text,
        record.status,
        record.converted_id,
        record.created_at,
        record.converted_at,
      ]
    );

    await this.eventLog
      .record("rabbit_hole.captured", "rabbit_hole", id, {
        active_task_id: record.active_task_id,
      })
      .catch((e) => console.error("event log failed:", e));

    return record;
  }

  async updateStatus(
    id: string,
    status: RabbitHoleStatus,
    convertedId?: string
  ): Promise<void> {
    const db = getDatabase();
    const now = new Date().toISOString();
    await db.execute(
      "UPDATE rabbit_holes SET status = ?, converted_id = ?, converted_at = ? WHERE id = ?;",
      [status, convertedId || null, now, id]
    );
    await this.eventLog
      .record(`rabbit_hole.${status}`, "rabbit_hole", id, { converted_id: convertedId || null })
      .catch((e) => console.error("event log failed:", e));
  }
}
