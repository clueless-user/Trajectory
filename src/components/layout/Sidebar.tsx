import React from "react";
import { useUIStore, ActiveView } from "../../stores/useUIStore";
import { useSessionStore } from "../../stores/useSessionStore";
import {
  Sun,
  Flame,
  CheckCircle2,
  FolderTree,
  FileText,
  Sunset,
  Zap,
  Columns3,
} from "lucide-react";

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView } = useUIStore();
  const { activeSession } = useSessionStore();

  const navigation: { id: ActiveView; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "today", label: "Today", icon: <Sun className="w-4 h-4" /> },
    { id: "planner", label: "Planner", icon: <Columns3 className="w-4 h-4 text-cyan-300" /> },
    {
      id: "deep_work",
      label: "Deep Work",
      icon: <Zap className="w-4 h-4 text-cyan-400" />,
      badge: activeSession ? "ACTIVE" : undefined,
    },
    { id: "habits", label: "Habits", icon: <Flame className="w-4 h-4 text-amber-400" /> },
    { id: "projects", label: "Hierarchy", icon: <FolderTree className="w-4 h-4 text-indigo-400" /> },
    { id: "brain_dump", label: "Brain Dump", icon: <FileText className="w-4 h-4 text-emerald-400" /> },
    { id: "review", label: "Daily Review", icon: <Sunset className="w-4 h-4 text-rose-400" /> },
  ];

  return (
    <aside className="w-52 border-r border-zinc-800/80 bg-zinc-950/40 p-3 flex flex-col justify-between shrink-0 select-none">
      <div className="flex flex-col gap-1">
        <div className="px-2 py-1 mb-2 text-[10px] font-mono tracking-wider text-zinc-500 uppercase">
          Workspace
        </div>
        {navigation.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-lg transition-all ${
                isActive
                  ? "bg-zinc-850 text-zinc-100 border border-zinc-750 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              {/* V-11: icon+text gap at the compact rhythm */}
              <div className="flex items-center gap-1.5">
                <span className="shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-1 py-0.2 rounded text-[9px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Trajectory status indicator at bottom of sidebar */}
      <div className="p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-850 text-xs">
        <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] mb-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Local Engine Active</span>
        </div>
        <div className="text-[10px] text-zinc-500 font-mono">SQLite Local-First</div>
      </div>
    </aside>
  );
};
