import React, { useState } from "react";
import { Modal } from "./common/Modal";
import { useUIStore } from "../stores/useUIStore";
import { useTaskStore } from "../stores/useTaskStore";
import { useSessionStore } from "../stores/useSessionStore";
import { seedDevelopmentData } from "../repositories/seed/devSeed";
import {
  Sun,
  Zap,
  Flame,
  FolderTree,
  FileText,
  Sunset,
  Plus,
  Lightbulb,
  ShieldAlert,
  Database,
  Columns3,
  ArrowDownCircle,
} from "lucide-react";

export const CommandPaletteModal: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    setActiveView,
    setNewTaskModalOpen,
    setRabbitHoleModalOpen,
    setCompressionModalOpen,
  } = useUIStore();

  const [query, setQuery] = useState("");

  const commands = [
    // Dev-only: the deterministic demo dataset. The seeder itself refuses to
    // run when real tasks exist, so this can never mix with user data.
    ...(import.meta.env.DEV
      ? [
          {
            id: "action-load-dev-seed",
            title: "Load Development Seed Data (Dev)",
            category: "Dev",
            icon: <Database className="w-4 h-4 text-amber-300" />,
            action: () => {
              seedDevelopmentData()
                .then(() => window.location.reload())
                .catch((err) => console.error("Dev seed failed:", err));
            },
          },
        ]
      : []),
    {
      id: "view-today",
      title: "Go to Today",
      category: "Navigation",
      icon: <Sun className="w-4 h-4 text-amber-400" />,
      action: () => setActiveView("today"),
    },
    {
      id: "view-planner",
      title: "Go to Planner Board",
      category: "Navigation",
      icon: <Columns3 className="w-4 h-4 text-cyan-300" />,
      action: () => setActiveView("planner"),
    },
    {
      id: "view-deep-work",
      title: "Go to Deep Work Cockpit",
      category: "Navigation",
      icon: <Zap className="w-4 h-4 text-cyan-400" />,
      action: () => setActiveView("deep_work"),
    },
    {
      id: "view-habits",
      title: "Go to Habits & Consistency",
      category: "Navigation",
      icon: <Flame className="w-4 h-4 text-emerald-400" />,
      action: () => setActiveView("habits"),
    },
    {
      id: "view-hierarchy",
      title: "Go to Life Areas & Projects",
      category: "Navigation",
      icon: <FolderTree className="w-4 h-4 text-indigo-400" />,
      action: () => setActiveView("projects"),
    },
    {
      id: "view-brain-dump",
      title: "Go to Brain Dump Scratchpad",
      category: "Navigation",
      icon: <FileText className="w-4 h-4 text-purple-400" />,
      action: () => setActiveView("brain_dump"),
    },
    {
      id: "view-review",
      title: "Start Daily Shutdown Review",
      category: "Navigation",
      icon: <Sunset className="w-4 h-4 text-rose-400" />,
      action: () => setActiveView("review"),
    },
    {
      id: "action-new-task",
      title: "Create New Task (N)",
      category: "Action",
      icon: <Plus className="w-4 h-4 text-zinc-300" />,
      action: () => setNewTaskModalOpen(true),
    },
    {
      id: "action-rabbit-hole",
      title: "Capture Rabbit Hole (R)",
      category: "Action",
      icon: <Lightbulb className="w-4 h-4 text-purple-300" />,
      action: () => setRabbitHoleModalOpen(true),
    },
    {
      id: "action-compress-day",
      title: "Compress Overloaded Day Plan",
      category: "Action",
      icon: <ShieldAlert className="w-4 h-4 text-rose-300" />,
      action: () => setCompressionModalOpen(true),
    },
    {
      id: "action-defer-current",
      title: "Defer Current Task",
      category: "Action",
      icon: <ArrowDownCircle className="w-4 h-4 text-amber-300" />,
      action: async () => {
        const { activeTaskId, moveTaskStatus } = useTaskStore.getState();
        if (!activeTaskId) return;
        const { activeSession, finishSession } = useSessionStore.getState();
        // Settle the running session before deferring — truthful history.
        if (activeSession?.taskId === activeTaskId) {
          await finishSession(false);
        }
        await moveTaskStatus(activeTaskId, "deferred");
      },
    },
  ];

  const filtered = commands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  const [highlightIndex, setHighlightIndex] = useState(0);
  const clampedIndex = Math.min(highlightIndex, Math.max(0, filtered.length - 1));

  const execute = (cmd: typeof commands[0]) => {
    setCommandPaletteOpen(false);
    setQuery("");
    setHighlightIndex(0);
    cmd.action();
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setHighlightIndex(0);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[clampedIndex];
      if (cmd) execute(cmd);
    }
  };

  return (
    <Modal
      isOpen={isCommandPaletteOpen}
      onClose={() => setCommandPaletteOpen(false)}
      title="Command Palette"
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Type a command or jump to view... (↑↓ + Enter)"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500"
        />

        <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
          {filtered.map((cmd, index) => (
            <button
              key={cmd.id}
              ref={(el) => {
                if (el && index === clampedIndex) el.scrollIntoView({ block: "nearest" });
              }}
              onClick={() => execute(cmd)}
              onMouseEnter={() => setHighlightIndex(index)}
              className={`flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                index === clampedIndex
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-300 hover:text-white hover:bg-zinc-800/80"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {cmd.icon}
                <span>{cmd.title}</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">{cmd.category}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="py-6 text-center text-xs text-zinc-500">No matching commands found.</div>
          )}
        </div>
      </div>
    </Modal>
  );
};
