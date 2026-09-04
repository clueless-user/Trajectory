import { getDatabase } from "./database";
import { Task, Action, TaskSchema } from "../domain/models/types";

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

  async getInboxTasks(): Promise<Task[]> {
    const db = getDatabase();
    return await db.select<Task>(
      `SELECT * FROM tasks 
       WHERE deleted_at IS NULL AND status = 'inbox'
       ORDER BY created_at DESC;`
    );
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

  async getActionsByTaskId(taskId: string): Promise<Action[]> {
    const db = getDatabase();
    const rows = await db.select<{
      id: string;
      task_id: string;
      title: string;
      is_completed: number;
      order_index: number;
      created_at: string;
      completed_at: string | null;
    }>("SELECT * FROM actions WHERE task_id = ? ORDER BY order_index ASC;", [taskId]);

    return rows.map((r) => ({
      ...r,
      is_completed: Boolean(r.is_completed),
    }));
  }

  async createAction(taskId: string, title: string): Promise<Action> {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.execute(
      "INSERT INTO actions (id, task_id, title, is_completed, order_index, created_at) VALUES (?, ?, ?, 0, 0, ?);",
      [id, taskId, title, now]
    );
    return {
      id,
      task_id: taskId,
      title,
      is_completed: false,
      order_index: 0,
      created_at: now,
      completed_at: null,
    };
  }

  async toggleAction(id: string, isCompleted: boolean): Promise<void> {
    const db = getDatabase();
    const completedAt = isCompleted ? new Date().toISOString() : null;
    await db.execute(
      "UPDATE actions SET is_completed = ?, completed_at = ? WHERE id = ?;",
      [isCompleted ? 1 : 0, completedAt, id]
    );
  }
}
