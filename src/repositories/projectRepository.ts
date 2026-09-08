import { getDatabase } from "./database";
import { Area, Project, AreaSchema, ProjectSchema } from "../domain/models/types";

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

function parseProject(row: unknown): Project {
  const result = ProjectSchema.safeParse(row);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    throw new Error(`Project record failed schema validation (${detail})`);
  }
  return result.data;
}

/**
 * Hierarchy repository: areas (read; writes live in AreaRepository) and
 * projects (full CRUD). Projects may attach to a goal, an area, or both —
 * the schema allows either parent to be NULL. Hard delete — no deleted_at.
 */
export class ProjectRepository {
  async getProject(id: string): Promise<Project | null> {
    const db = getDatabase();
    const rows = await db.select<unknown>("SELECT * FROM projects WHERE id = ? LIMIT 1;", [id]);
    return rows[0] ? parseProject(rows[0]) : null;
  }

  async getProjects(): Promise<Project[]> {
    const db = getDatabase();
    const rows = await db.select<unknown>("SELECT * FROM projects ORDER BY order_index ASC;");
    return rows.map(parseProject);
  }

  async getAreas(): Promise<Area[]> {
    const db = getDatabase();
    const rows = await db.select<unknown>("SELECT * FROM areas ORDER BY order_index ASC;");
    return rows.map(parseArea);
  }

  async createProject(params: {
    title: string;
    goal_id?: string | null;
    area_id?: string | null;
    description?: string | null;
  }): Promise<Project> {
    const db = getDatabase();
    const project: Project = {
      id: crypto.randomUUID(),
      goal_id: params.goal_id ?? null,
      area_id: params.area_id ?? null,
      title: params.title,
      description: params.description ?? null,
      status: "active",
      order_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    ProjectSchema.parse(project);

    await db.execute(
      `INSERT INTO projects (id, goal_id, area_id, title, description, status, order_index, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        project.id,
        project.goal_id,
        project.area_id,
        project.title,
        project.description,
        project.status,
        project.order_index,
        project.created_at,
        project.updated_at,
      ]
    );
    return project;
  }

  async updateProject(
    id: string,
    updates: Partial<Pick<Project, "title" | "description" | "status">>
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
    await db.execute(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?;`, values);
  }

  async deleteProject(id: string): Promise<void> {
    const db = getDatabase();
    await db.execute("DELETE FROM projects WHERE id = ?;", [id]);
  }
}
