import React, { useEffect, useState } from "react";
import { getDatabase } from "../repositories/database";
import { Area, Project, Task } from "../domain/models/types";
import { ImportanceBadge, CognitiveBadge, StatusBadge } from "../components/common/Badge";
import { FolderTree, Folder, CheckSquare } from "lucide-react";

export const ProjectsView: React.FC = () => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const db = getDatabase();
      const loadedAreas = await db.select<Area>("SELECT * FROM areas ORDER BY order_index ASC;");
      const loadedProjects = await db.select<Project>("SELECT * FROM projects ORDER BY order_index ASC;");
      const loadedTasks = await db.select<Task>("SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at DESC;");

      setAreas(loadedAreas);
      setProjects(loadedProjects);
      setTasks(loadedTasks);

      if (loadedProjects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(loadedProjects[0].id);
      }
    }
    loadData();
  }, [selectedProjectId]);

  const activeProjectTasks = tasks.filter((t) => t.project_id === selectedProjectId || !selectedProjectId);

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-6xl 2xl:max-w-7xl mx-auto w-full">
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderTree className="w-5 h-5 text-indigo-400" />
          <div>
            <h1 className="text-base font-bold text-zinc-100">Hierarchy & Execution Architecture</h1>
            <p className="text-xs text-zinc-400">
              Life Area → Goal → Project → Task → Action
            </p>
          </div>
        </div>
        <div className="text-xs font-mono text-zinc-500">
          {areas.length} Areas • {projects.length} Projects • {tasks.length} Tasks
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Life Areas & Projects Tree */}
        <div className="flex flex-col gap-4">
          <div className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
            Life Areas
          </div>
          <div className="flex flex-col gap-3">
            {areas.map((area) => {
              const areaProjects = projects.filter((p) => p.area_id === area.id);

              return (
                <div
                  key={area.id}
                  className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-850 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: area.color }}
                    />
                    <span className="text-xs font-semibold text-zinc-200">{area.name}</span>
                  </div>

                  <div className="pl-4 flex flex-col gap-1 border-l border-zinc-800 mt-1">
                    {areaProjects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProjectId(p.id)}
                        className={`text-left text-xs px-2 py-1 rounded transition-colors flex items-center gap-1.5 ${
                          selectedProjectId === p.id
                            ? "bg-indigo-950/60 text-indigo-300 border border-indigo-800/80 font-medium"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <Folder className="w-3 h-3 text-zinc-500 shrink-0" />
                        <span className="truncate">{p.title}</span>
                      </button>
                    ))}
                    {areaProjects.length === 0 && (
                      <span className="text-[11px] text-zinc-600 italic">No projects yet</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Columns: Tasks under Selected Hierarchy */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
              Tasks in Focus ({activeProjectTasks.length})
            </div>
            <button
              onClick={() => setSelectedProjectId(null)}
              className={`text-xs ${
                selectedProjectId === null ? "text-cyan-300 font-semibold" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Show All Tasks
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {activeProjectTasks.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 truncate">
                  <CheckSquare className="w-4 h-4 text-zinc-600 shrink-0" />
                  <div className="truncate">
                    <div className="text-xs font-medium text-zinc-200 truncate">{t.title}</div>
                    {t.description && (
                      <div className="text-[11px] text-zinc-500 truncate">{t.description}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={t.status} />
                  <ImportanceBadge importance={t.importance} />
                  <CognitiveBadge demand={t.cognitive_demand} />
                  <span className="font-mono text-xs text-zinc-400">{t.estimated_minutes}m</span>
                </div>
              </div>
            ))}

            {activeProjectTasks.length === 0 && (
              <div className="p-8 text-center text-xs text-zinc-500 bg-zinc-950/40 rounded-lg border border-dashed border-zinc-800">
                No tasks found for this view.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
