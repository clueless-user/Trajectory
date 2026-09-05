import { getDatabase } from "./database";
import { Area, Project } from "../domain/models/types";

/**
 * Read-only access to the planning hierarchy (areas/projects). Tasks own
 * their repository; projects/areas have no write paths yet.
 */
export class ProjectRepository {
  async getProject(id: string): Promise<Project | null> {
    const db = getDatabase();
    const rows = await db.select<Project>("SELECT * FROM projects WHERE id = ? LIMIT 1;", [id]);
    return rows[0] ?? null;
  }

  async getProjects(): Promise<Project[]> {
    const db = getDatabase();
    return await db.select<Project>("SELECT * FROM projects ORDER BY order_index ASC;");
  }

  async getAreas(): Promise<Area[]> {
    const db = getDatabase();
    return await db.select<Area>("SELECT * FROM areas ORDER BY order_index ASC;");
  }
}
