import { getDatabase } from "./database";
import { Area, AreaSchema } from "../domain/models/types";

function parseArea(row: unknown): Area {
  const result = AreaSchema.safeParse(row);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    throw new Error(`Area record failed schema validation (${detail})`);
  }
  return result.data;
}

/**
 * Life-area CRUD. Seeded areas use fixed UUIDs (G-06) — creation never
 * regenerates them; user-created areas get fresh UUIDs. The table has no
 * deleted_at column, so deletes are hard (documented debt).
 */
export class AreaRepository {
  async getAllAreas(): Promise<Area[]> {
    const db = getDatabase();
    const rows = await db.select<unknown>("SELECT * FROM areas ORDER BY order_index ASC;");
    return rows.map(parseArea);
  }

  async getArea(id: string): Promise<Area | null> {
    const db = getDatabase();
    const rows = await db.select<unknown>("SELECT * FROM areas WHERE id = ? LIMIT 1;", [id]);
    return rows[0] ? parseArea(rows[0]) : null;
  }

  async createArea(params: {
    name: string;
    description?: string | null;
    color?: string;
    orderIndex?: number;
  }): Promise<Area> {
    const db = getDatabase();
    const area: Area = {
      id: crypto.randomUUID(),
      name: params.name,
      description: params.description ?? null,
      color: params.color ?? "#3b82f6",
      order_index: params.orderIndex ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    AreaSchema.parse(area);

    await db.execute(
      `INSERT INTO areas (id, name, description, color, order_index, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [area.id, area.name, area.description, area.color, area.order_index, area.created_at, area.updated_at]
    );
    return area;
  }

  async updateArea(id: string, updates: Partial<Pick<Area, "name" | "description" | "color">>): Promise<void> {
    const db = getDatabase();
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (key !== "id") {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (fields.length === 0) return;
    fields.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(id);
    await db.execute(`UPDATE areas SET ${fields.join(", ")} WHERE id = ?;`, values);
  }

  // Hard delete (no deleted_at on areas). Goals follow via FK ON DELETE
  // CASCADE? No — the schema declares SET NULL on goals.area_id, so goals
  // survive area deletion as orphans; the store layer removes them
  // explicitly (documented in useHierarchyStore).
  async deleteArea(id: string): Promise<void> {
    const db = getDatabase();
    await db.execute("DELETE FROM areas WHERE id = ?;", [id]);
  }
}
