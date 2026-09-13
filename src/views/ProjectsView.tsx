import React, { useEffect, useState } from "react";
import { useHierarchyStore } from "../stores/useHierarchyStore";
import { useTaskStore } from "../stores/useTaskStore";
import { Area, Goal, Project } from "../domain/models/types";
import { ImportanceBadge, CognitiveBadge, StatusBadge } from "../components/common/Badge";
import { ConfirmIconButton } from "../components/common/ConfirmIconButton";
import { FolderTree, Folder, CheckSquare, Pencil, Trash2, Plus, Target } from "lucide-react";

// Inline-form state: creation forms carry the parent; rename forms the target.
type Form =
  | null
  | { kind: "area" }
  | { kind: "goal"; areaId: string }
  | { kind: "project"; goalId?: string; areaId?: string }
  | { kind: "rename-area"; id: string }
  | { kind: "rename-goal"; id: string }
  | { kind: "rename-project"; id: string };

// Inline single-line text form: Enter commits, Escape cancels. Used for
// creation AND inline rename — no modal machinery needed.
const InlineTextForm: React.FC<{
  placeholder: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}> = ({ placeholder, onCommit, onCancel }) => (
  <input
    autoFocus
    type="text"
    placeholder={placeholder}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        const text = e.currentTarget.value.trim();
        if (text) onCommit(text);
        else onCancel();
      } else if (e.key === "Escape") {
        onCancel();
      }
      e.stopPropagation();
    }}
    onBlur={onCancel}
    onClick={(e) => e.stopPropagation()}
    className="w-full bg-zinc-950 border border-indigo-500/50 rounded px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
  />
);

export const ProjectsView: React.FC = () => {
  const {
    areas,
    goals,
    projects,
    isLoading,
    loadHierarchy,
    createArea,
    updateArea,
    deleteArea,
    createGoal,
    updateGoal,
    deleteGoal,
    createProject,
    updateProject,
    deleteProject,
  } = useHierarchyStore();
  const { boardTasks, loadBoard } = useTaskStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(null);

  // Single load on mount — no refetch on every selection change (G-27 tail).
  useEffect(() => {
    loadHierarchy();
    loadBoard();
  }, [loadHierarchy, loadBoard]);

  const activeProjectTasks = boardTasks.filter(
    (t) => t.project_id === selectedProjectId || !selectedProjectId
  );

  const goalsOf = (area: Area) => goals.filter((g) => g.area_id === area.id);
  const projectsOfGoal = (goal: Goal) => projects.filter((p) => p.goal_id === goal.id);
  // Goal-less projects attached directly to an area (schema allows area-only).
  const areaProjects = (area: Area) => projects.filter((p) => p.area_id === area.id && !p.goal_id);
  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : null;

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
          {areas.length} Areas • {goals.length} Goals • {projects.length} Projects • {boardTasks.length} Tasks
        </div>
      </div>

      {isLoading && <div className="text-xs text-zinc-500">Loading hierarchy…</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Life Area → Goal → Project tree */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
              Life Areas
            </div>
            {form?.kind !== "area" && (
              <button
                onClick={() => setForm({ kind: "area" })}
                className="text-[11px] text-zinc-500 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Add Area</span>
              </button>
            )}
          </div>

          {form?.kind === "area" && (
            <InlineTextForm
              placeholder="New life area (e.g. Health)…"
              onCommit={(text) => {
                createArea(text);
                setForm(null);
              }}
              onCancel={() => setForm(null)}
            />
          )}

          <div className="flex flex-col gap-3">
            {areas.map((area) => (
              <div key={area.id} className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-850 flex flex-col gap-2">
                {/* Area header row */}
                <div className="flex items-center gap-2 group/area">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: area.color }} />
                  {form?.kind === "rename-area" && form.id === area.id ? (
                    <InlineTextForm
                      placeholder="Area name…"
                      onCommit={(text) => {
                        updateArea(area.id, text);
                        setForm(null);
                      }}
                      onCancel={() => setForm(null)}
                    />
                  ) : (
                    <>
                      <span className="text-xs font-semibold text-zinc-200 truncate">{area.name}</span>
                      <span className="ml-auto flex items-center gap-0.5 opacity-0 group-hover/area:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => setForm({ kind: "rename-area", id: area.id })}
                          className="flex items-center justify-center p-1 rounded text-zinc-600 hover:text-cyan-300 hover:bg-zinc-800 transition-colors"
                          title="Rename area"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <ConfirmIconButton
                          onConfirm={() => deleteArea(area.id)}
                          title="Delete area (and its goals)"
                        >
                          <Trash2 className="w-3 h-3" />
                        </ConfirmIconButton>
                      </span>
                    </>
                  )}
                </div>

                {/* Goals under the area */}
                <div className="pl-4 flex flex-col gap-1.5 border-l border-zinc-800 mt-1">
                  {goalsOf(area).map((goal) => (
                    <GoalNode
                      key={goal.id}
                      goal={goal}
                      projects={projectsOfGoal(goal)}
                      selectedProjectId={selectedProjectId}
                      onSelectProject={setSelectedProjectId}
                      form={form}
                      setForm={setForm}
                      onRenameGoal={(id) => setForm({ kind: "rename-goal", id })}
                      onCommitRenameGoal={(id, title) => {
                        updateGoal(id, title);
                        setForm(null);
                      }}
                      onDeleteGoal={deleteGoal}
                      onCommitProject={(title, goalId) => {
                        createProject(title, { goalId, areaId: area.id });
                        setForm(null);
                      }}
                      onRenameProject={(id) => setForm({ kind: "rename-project", id })}
                      onCommitRenameProject={(id, title) => {
                        updateProject(id, title);
                        setForm(null);
                      }}
                      onDeleteProject={deleteProject}
                    />
                  ))}

                  {/* Goal-less area projects */}
                  {areaProjects(area).map((p) => (
                    <ProjectRow
                      key={p.id}
                      project={p}
                      selected={selectedProjectId === p.id}
                      onSelect={() => setSelectedProjectId(p.id)}
                      renaming={form?.kind === "rename-project" && form.id === p.id}
                      onRename={() => setForm({ kind: "rename-project", id: p.id })}
                      onCommitRename={(title) => {
                        updateProject(p.id, title);
                        setForm(null);
                      }}
                      onDelete={() => deleteProject(p.id)}
                    />
                  ))}

                  {goalsOf(area).length === 0 && areaProjects(area).length === 0 && (
                    <span className="text-[11px] text-zinc-600 italic">No goals yet — add one below</span>
                  )}

                  {/* Create goal / area-level project */}
                  <div className="flex items-center gap-2 pt-0.5">
                    {form?.kind === "goal" && form.areaId === area.id ? (
                      <InlineTextForm
                        placeholder="New goal (e.g. Run Marathon)…"
                        onCommit={(text) => {
                          createGoal(text, area.id);
                          setForm(null);
                        }}
                        onCancel={() => setForm(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setForm({ kind: "goal", areaId: area.id })}
                        className="text-[11px] text-zinc-600 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Goal</span>
                      </button>
                    )}
                    {form?.kind === "project" && form.areaId === area.id && !form.goalId ? (
                      <InlineTextForm
                        placeholder="New project…"
                        onCommit={(text) => {
                          createProject(text, { areaId: area.id });
                          setForm(null);
                        }}
                        onCancel={() => setForm(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setForm({ kind: "project", areaId: area.id })}
                        className="text-[11px] text-zinc-600 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Project</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {areas.length === 0 && (
              <div className="py-6 text-center text-[11px] text-zinc-600 border border-dashed border-zinc-800 rounded-lg">
                No areas yet. Add your first life area above.
              </div>
            )}
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
          {selectedProject && (
            <div className="text-[11px] font-mono text-indigo-300 bg-indigo-950/40 border border-indigo-900/50 rounded-lg px-3 py-1.5 self-start">
              Project: {selectedProject.title}
            </div>
          )}

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

// ---------------- Goal node (goal header + its projects) ----------------
interface GoalNodeProps {
  goal: Goal;
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  form: Form;
  setForm: (f: Form) => void;
  onRenameGoal: (id: string) => void;
  onCommitRenameGoal: (id: string, title: string) => void;
  onDeleteGoal: (id: string) => void;
  onCommitProject: (title: string, goalId: string) => void;
  onRenameProject: (id: string) => void;
  onCommitRenameProject: (id: string, title: string) => void;
  onDeleteProject: (id: string) => void;
}

const GoalNode: React.FC<GoalNodeProps> = ({
  goal,
  projects,
  selectedProjectId,
  onSelectProject,
  form,
  setForm,
  onRenameGoal,
  onCommitRenameGoal,
  onDeleteGoal,
  onCommitProject,
  onRenameProject,
  onCommitRenameProject,
  onDeleteProject,
}) => {
  const renaming = form?.kind === "rename-goal" && form.id === goal.id;
  const addingProject = form?.kind === "project" && form.goalId === goal.id;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 group/goal">
        <Target className="w-3.5 h-3.5 text-cyan-500/70 shrink-0" />
        {renaming ? (
          <InlineTextForm
            placeholder="Goal name…"
            onCommit={(text) => onCommitRenameGoal(goal.id, text)}
            onCancel={() => setForm(null)}
          />
        ) : (
          <>
            <span className="text-xs text-zinc-300 truncate">{goal.title}</span>
            <span className="ml-auto flex items-center gap-0.5 opacity-0 group-hover/goal:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => onRenameGoal(goal.id)}
                className="flex items-center justify-center p-1 rounded text-zinc-600 hover:text-cyan-300 hover:bg-zinc-800 transition-colors"
                title="Rename goal"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <ConfirmIconButton onConfirm={() => onDeleteGoal(goal.id)} title="Delete goal">
                <Trash2 className="w-3 h-3" />
              </ConfirmIconButton>
            </span>
          </>
        )}
      </div>

      <div className="pl-4 flex flex-col gap-1">
        {projects.map((p) => (
          <ProjectRow
            key={p.id}
            project={p}
            selected={selectedProjectId === p.id}
            onSelect={() => onSelectProject(p.id)}
            renaming={form?.kind === "rename-project" && form.id === p.id}
            onRename={() => onRenameProject(p.id)}
            onCommitRename={(title) => onCommitRenameProject(p.id, title)}
            onDelete={() => onDeleteProject(p.id)}
          />
        ))}
        {projects.length === 0 && <span className="text-[11px] text-zinc-600 italic">No projects yet</span>}

        {addingProject ? (
          <InlineTextForm
            placeholder="New project…"
            onCommit={(text) => onCommitProject(text, goal.id)}
            onCancel={() => setForm(null)}
          />
        ) : (
          <button
            onClick={() => setForm({ kind: "project", goalId: goal.id })}
            className="text-[11px] text-zinc-600 hover:text-indigo-300 flex items-center gap-1 transition-colors w-fit"
          >
            <Plus className="w-3 h-3" />
            <span>Project</span>
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------- Project row ----------------
const ProjectRow: React.FC<{
  project: Project;
  selected: boolean;
  onSelect: () => void;
  renaming: boolean;
  onRename: () => void;
  onCommitRename: (title: string) => void;
  onDelete: () => void;
}> = ({ project, selected, onSelect, renaming, onRename, onCommitRename, onDelete }) => (
  <div
    onClick={onSelect}
    className={`text-left text-xs px-2 py-1 rounded transition-colors flex items-center gap-1.5 group/project cursor-pointer ${
      selected
        ? "bg-indigo-950/60 text-indigo-300 border border-indigo-800/80 font-medium"
        : "text-zinc-400 hover:text-zinc-200 border border-transparent"
    }`}
  >
    <Folder className="w-3 h-3 text-zinc-500 shrink-0" />
    {renaming ? (
      <InlineTextForm placeholder="Project name…" onCommit={onCommitRename} onCancel={() => undefined} />
    ) : (
      <>
        <span className="truncate flex-1">{project.title}</span>
        <span className="flex items-center gap-0.5 opacity-0 group-hover/project:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRename();
            }}
            className="flex items-center justify-center p-0.5 rounded text-zinc-600 hover:text-cyan-300 hover:bg-zinc-800 transition-colors"
            title="Rename project"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <ConfirmIconButton onConfirm={onDelete} title="Delete project" className="!p-0.5">
            <Trash2 className="w-3 h-3" />
          </ConfirmIconButton>
        </span>
      </>
    )}
  </div>
);
