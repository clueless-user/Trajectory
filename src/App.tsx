import React, { useEffect, useState } from "react";
import { initializeDatabase } from "./repositories/database";
import { todayLocal } from "./domain/time/date";
import { useTaskStore } from "./stores/useTaskStore";
import { useHabitStore } from "./stores/useHabitStore";
import { useStateStore } from "./stores/useStateStore";
import { useSessionStore } from "./stores/useSessionStore";
import { useUIStore } from "./stores/useUIStore";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";

import { TodayView } from "./views/TodayView";
import { DeepWorkView } from "./views/DeepWorkView";
import { HabitsView } from "./views/HabitsView";
import { ProjectsView } from "./views/ProjectsView";
import { BrainDumpView } from "./views/BrainDumpView";
import { ReviewView } from "./views/ReviewView";

import { RabbitHoleModal } from "./components/RabbitHoleModal";
import { NewTaskModal } from "./components/NewTaskModal";
import { CompressionModal } from "./components/CompressionModal";
import { CommandPaletteModal } from "./components/CommandPaletteModal";

export const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const { activeView } = useUIStore();
  const { loadTodayTasks } = useTaskStore();
  const { loadHabitsAndTodayLogs } = useHabitStore();
  const { loadTodayState } = useStateStore();
  const { loadInterruptedSessions } = useSessionStore();

  useKeyboardShortcuts();

  useEffect(() => {
    async function boot() {
      try {
        await initializeDatabase();
        const todayStr = todayLocal();
        await Promise.all([
          loadTodayTasks(todayStr),
          loadHabitsAndTodayLogs(todayStr),
          loadTodayState(todayStr),
          loadInterruptedSessions(),
        ]);
        setIsReady(true);
      } catch (err) {
        console.error("Boot error:", err);
        setBootError(err instanceof Error ? err.message : String(err));
      }
    }
    boot();
  }, [loadTodayTasks, loadHabitsAndTodayLogs, loadTodayState, loadInterruptedSessions]);

  if (bootError) {
    return (
      <div className="h-screen w-screen bg-canvas-base flex flex-col items-center justify-center gap-4 text-zinc-400 select-none px-8">
        <div className="font-mono text-xs text-red-400 tracking-wider">
          DATABASE FAILURE
        </div>
        <div className="max-w-xl text-sm text-zinc-400 text-center leading-relaxed">
          Trajectory could not open its local SQLite database and has stopped
          rather than run without persistence. No data was written or lost by
          this session.
        </div>
        <div className="max-w-xl font-mono text-xs text-zinc-600 text-center break-all">
          {bootError}
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="h-screen w-screen bg-canvas-base flex flex-col items-center justify-center gap-3 text-zinc-400 select-none">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
        <div className="font-mono text-xs text-zinc-500 tracking-wider">
          INITIALIZING TRAJECTORY ENGINE...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-canvas-base flex flex-col overflow-hidden text-text-primary">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden bg-zinc-950/20">
          {activeView === "today" && <TodayView />}
          {activeView === "deep_work" && <DeepWorkView />}
          {activeView === "habits" && <HabitsView />}
          {activeView === "projects" && <ProjectsView />}
          {activeView === "brain_dump" && <BrainDumpView />}
          {activeView === "review" && <ReviewView />}
        </main>
      </div>

      {/* Global Interactive Modals */}
      <RabbitHoleModal />
      <NewTaskModal />
      <CompressionModal />
      <CommandPaletteModal />
    </div>
  );
};
