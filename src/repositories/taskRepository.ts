// Tasks (tasks table), soft-deleted via deleted_at (rows survive for
// history/reports; every read filters deleted_at IS NULL unless the caller
// opts in). Statuses flow inbox -> planned/in_progress -> completed; sorting
// is importance-ordered first, then manual order_index, then recency.
import { getDatabase } from "./database";
import { Task, TaskSchema } from "../domain/models/types";

// Runtime validation at the persistence boundary: rows and constructed
// records must satisfy the domain schema or the call fails loudly.
function parseTask(row: unknown): Task {
  const result = TaskSchema.safeParse(row);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    throw new Error(`Task record failed schema validation (${detail})`);
  }
  return result.data;
}

export class TaskRepository {
  async getAllTasks(includeDeleted = false): Promise<Task[]> {
    const db = getDatabase();
    const whereClause = includeDeleted ? "" : "WHERE deleted_at IS NULL";
    const rows = await db.select<unknown>(
      `SELECT * FROM tasks ${whereClause} ORDER BY 
        CASE importance 
          WHEN 'critical' THEN 1 
          WHEN 'important' THEN 2 
          WHEN 'optional' THEN 3 
          ELSE 4 
        END, order_index ASC, created_at DESC;`
    );
    return rows.map(parseTask);
  }

  async getTodayTasks(date: string): Promise<Task[]> {
    // In-progress tasks with no scheduled date are pinned to "today" so an
    // active session never disappears from the Now screen.
    const db = getDatabase();
    const rows = await db.select<unknown>(
      `SELECT * FROM tasks 
       WHERE deleted_at IS NULL 
         AND (scheduled_date = ? OR (status = 'in_progress' AND scheduled_date IS NULL))
       ORDER BY 
        CASE importance 
          WHEN 'critical' THEN 1 
          WHEN 'important' THEN 2 
          WHEN 'optional' THEN 3 
          ELSE 4 
        END, order_index ASC, created_at DESC;`,
      [date]
    );
    return rows.map(parseTask);
  }

  async getTaskById(id: string): Promise<Task | null> {
    const db = getDatabase();
    const results = await db.select<unknown>(
      "SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL LIMIT 1;",
      [id]
    );
    return results[0] ? parseTask(results[0]) : null;
  }

  async createTask(task: Partial<Task> & { title: string }): Promise<Task> {
    const db = getDatabase();
    const id = task.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const newTask: Task = {
      id,
      project_id: task.project_id || null,
      title: task.title,
      description: task.description || null,
      importance: task.importance || "important",
      cognitive_demand: task.cognitive_demand || "medium",
      status: task.status || "inbox",
      estimated_minutes: task.estimated_minutes ?? 30,
      actual_minutes: task.actual_minutes ?? 0,
      scheduled_date: task.scheduled_date || null,
      due_date: task.due_date || null,
      completed_at: task.completed_at || null,
      order_index: task.order_index ?? 0,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    await db.execute(
      `INSERT INTO tasks (
        id, project_id, title, description, importance, cognitive_demand, 
        status, estimated_minutes, actual_minutes, scheduled_date, due_date, 
        completed_at, order_index, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        newTask.id,
        newTask.project_id,
        newTask.title,
        newTask.description,
        newTask.importance,
        newTask.cognitive_demand,
        newTask.status,
        newTask.estimated_minutes,
        newTask.actual_minutes,
        newTask.scheduled_date,
        newTask.due_date,
        newTask.completed_at,
        newTask.order_index,
        newTask.created_at,
        newTask.updated_at,
        newTask.deleted_at,
      ]
    );

    return newTask;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<void> {
    // Dynamic SET list from the update keys; id/created_at are immutable.
    // updated_at is always stamped so sync/history can rely on it.
    const db = getDatabase();
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== "id" && key !== "created_at") {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return;

    fields.push("updated_at = ?");
    values.push(now);
    values.push(id);

    await db.execute(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?;`, values);
  }

  async softDeleteTask(id: string): Promise<void> {
    const db = getDatabase();
    const now = new Date().toISOString();
    await db.execute("UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?;", [
      now,
      now,
      id,
    ]);
  }

  // Phase 2B: tasks completed in [startIso, endIso) (on completed_at). Bounds
  // are UTC instants derived from local days by the caller.
  async getTasksCompletedInRange(startIso: string, endIso: string): Promise<Task[]> {
    const db = getDatabase();
    const rows = await db.select<unknown>(
      `SELECT * FROM tasks
       WHERE deleted_at IS NULL AND status = 'completed'
         AND completed_at IS NOT NULL AND completed_at >= ? AND completed_at < ?;`,
      [startIso, endIso]
    );
    return rows.map(parseTask);
  }
}
