import { getDatabase } from "./database";
import { BrainDump, BrainDumpSchema } from "../domain/models/types";

export class BrainDumpRepository {
  async getLatestBrainDump(): Promise<BrainDump | null> {
    const db = getDatabase();
    const rows = await db.select<unknown>(
      "SELECT * FROM brain_dumps ORDER BY updated_at DESC LIMIT 1;"
    );
    return rows[0] ? BrainDumpSchema.parse(rows[0]) : null;
  }

  async saveBrainDump(content: string): Promise<BrainDump> {
    const db = getDatabase();
    const now = new Date().toISOString();
    const latest = await this.getLatestBrainDump();

    if (latest) {
      await db.execute(
        "UPDATE brain_dumps SET content = ?, updated_at = ? WHERE id = ?;",
        [content, now, latest.id]
      );
      return {
        ...latest,
        content,
        updated_at: now,
      };
    } else {
      const id = crypto.randomUUID();
      await db.execute(
        "INSERT INTO brain_dumps (id, content, created_at, updated_at) VALUES (?, ?, ?, ?);",
        [id, content, now, now]
      );
      return {
        id,
        content,
        created_at: now,
        updated_at: now,
      };
    }
  }
}
