// Top app bar: brand, execution-mode switcher, and quick-action triggers
// (Ctrl+K command palette, R rabbit hole, D brain dump, N new task).
// Mode chips only set the execution mode, except deep_work/shutdown which
// additionally navigate to the Deep Work / Daily Review views respectively.
import React from "react";
import { useUIStore } from "../../stores/useUIStore";
import { ExecutionMode } from "../../domain/models/types";
import { Plus, Lightbulb, Compass, Search } from "lucide-react";

export const Header: React.FC = () => {
  const {
    activeMode,
    setActiveMode,
    setNewTaskModalOpen,
    setRabbitHoleModalOpen,
    setCommandPaletteOpen,
    setActiveView,
  } = useUIStore();

  const modes: { id: ExecutionMode; label: string; color: string }[] = [
    { id: "deep_work", label: "Deep Work", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
    { id: "admin", label: "Admin", color: "bg-zinc-700/40 text-zinc-300 border-zinc-600/40" },
    { id: "learning", label: "Learning", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
    { id: "physical", label: "Physical", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    { id: "shutdown", label: "Shutdown", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  ];

  return (
    <header className="h-12 border-b border-zinc-800/90 bg-zinc-950/90 px-4 flex items-center justify-between select-none shrink-0 z-30">
      {/* Brand & Mode */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.6)]" />
          <span className="font-mono font-bold tracking-tight text-sm text-zinc-100">TRAJECTORY</span>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center bg-zinc-900/80 p-0.5 rounded-md border border-zinc-800">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setActiveMode(m.id);
                // Two modes double as destinations: entering deep work or
                // shutdown jumps straight to the relevant view; the others
                // only tint the current view's context.
                if (m.id === "deep_work") setActiveView("deep_work");
                if (m.id === "shutdown") setActiveView("review");
              }}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition-all ${
                activeMode === m.id
                  ? `${m.color} border font-semibold shadow-sm`
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Action Triggers */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 px-2.5 py-1 text-xs text-zinc-400 bg-zinc-900/90 border border-zinc-800 rounded-md hover:text-zinc-200 hover:border-zinc-700 transition-colors"
        >
          <Search className="w-3 h-3 text-zinc-400" />
          <span className="hidden sm:inline">Commands</span>
          <kbd className="text-[10px] font-mono bg-zinc-800 px-1 rounded text-zinc-400">Ctrl+K</kbd>
        </button>

        <button
          onClick={() => setRabbitHoleModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-purple-300 bg-purple-950/40 border border-purple-800/60 rounded-md hover:bg-purple-900/50 transition-colors"
          title="Capture Rabbit Hole without leaving task (Hotkey: R)"
        >
          <Lightbulb className="w-3 h-3" />
          <span>Rabbit Hole</span>
          <kbd className="text-[10px] font-mono bg-purple-900/80 px-1 rounded text-purple-200">R</kbd>
        </button>

        <button
          onClick={() => setActiveView("brain_dump")}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/60 rounded-md hover:bg-amber-900/50 transition-colors"
          title="Open Brain Dump scratchpad (Hotkey: D)"
        >
          <Compass className="w-3 h-3" />
          <span>Dump</span>
          <kbd className="text-[10px] font-mono bg-amber-900/80 px-1 rounded text-amber-200">D</kbd>
        </button>

        <button
          onClick={() => setNewTaskModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-900 bg-zinc-100 rounded-md hover:bg-white font-medium transition-colors"
          title="New Task (Hotkey: N)"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Task</span>
          <kbd className="text-[10px] font-mono bg-zinc-300 px-1 rounded text-zinc-800">N</kbd>
        </button>
      </div>
    </header>
  );
};
