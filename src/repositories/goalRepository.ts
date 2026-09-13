import { getDatabase } from "./database";
import { Goal, GoalSchema } from "../domain/models/types";

function parseGoal(row: unknown): Goal {
  const result = GoalSchema.safeParse(row);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    throw new Error(`Goal record failed schema validation (${detail})`);
  }
  return result.data;
}

/**
 * Goal CRUD. Goals sit between areas and projects in the hierarchy; the
 * schema allows area-less goals (area_id NULL). Hard delete — no deleted_at.
 */
export class GoalRepository {
  async getAllGoals(): Promise<Goal[]> {
    const db = getDatabase();
    const rows = await db.select<unknown>(
      "SELECT * FROM goals ORDER BY order_index ASC, created_at ASC;"
    );
    return rows.map(parseGoal);
  }

  async getGoalsByArea(areaId: string): Promise<Goal[]> {
    const db = getDatabase();
    const rows = await db.select<unknown>(
      "SELECT * FROM goals WHERE area_id = ? ORDER BY order_index ASC, created_at ASC;",
      [areaId]
    );
    return rows.map(parseGoal);
  }

  async createGoal(params: {
    title: string;
    area_id?: string | null;
    description?: string | null;
  }): Promise<Goal> {
    const db = getDatabase();
    const goal: Goal = {
      id: crypto.randomUUID(),
      area_id: params.area_id ?? null,
      title: params.title,
      description: params.description ?? null,
      target_date: null,
      status: "active",
      parked_until: null,
      order_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    GoalSchema.parse(goal);

    await db.execute(
      `INSERT INTO goals (id, area_id, title, description, target_date, status, parked_until, order_index, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        goal.id,
        goal.area_id,
        goal.title,
        goal.description,
        goal.target_date,
        goal.status,
        goal.parked_until,
        goal.order_index,
        goal.created_at,
        goal.updated_at,
      ]
    );
    return goal;
  }

  // status='paused' + parked_until=<local day> is the Phase 2C parking flow.
  async updateGoal(
    id: string,
    updates: Partial<Pick<Goal, "title" | "description" | "status" | "parked_until">>
  ): Promise<void> {
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
    await db.execute(`UPDATE goals SET ${fields.join(", ")} WHERE id = ?;`, values);
  }

  async deleteGoal(id: string): Promise<void> {
    const db = getDatabase();
    await db.execute("DELETE FROM goals WHERE id = ?;", [id]);
  }
}
