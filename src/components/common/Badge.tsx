import React from "react";
import { Importance, CognitiveDemand, TaskStatus } from "../../domain/models/types";

interface BadgeProps {
  children?: React.ReactNode;
  variant?: "default" | "critical" | "important" | "optional" | "deep" | "medium" | "shallow" | "status";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = "default", className = "" }) => {
  const variantStyles: Record<string, string> = {
    default: "bg-zinc-800 text-zinc-300 border-zinc-700",
    critical: "bg-rose-950/60 text-rose-300 border-rose-800/80 font-semibold",
    important: "bg-amber-950/60 text-amber-300 border-amber-800/80",
    optional: "bg-zinc-850 text-zinc-400 border-zinc-750",
    deep: "bg-cyan-950/60 text-cyan-300 border-cyan-800/80",
    medium: "bg-blue-950/60 text-blue-300 border-blue-800/80",
    shallow: "bg-zinc-800 text-zinc-400 border-zinc-700",
    status: "bg-zinc-800/80 text-zinc-300 border-zinc-700",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono tracking-tight border ${
        variantStyles[variant] || variantStyles.default
      } ${className}`}
    >
      {children}
    </span>
  );
};

export const ImportanceBadge: React.FC<{ importance: Importance }> = ({ importance }) => {
  return <Badge variant={importance}>{importance.toUpperCase()}</Badge>;
};

export const CognitiveBadge: React.FC<{ demand: CognitiveDemand }> = ({ demand }) => {
  return <Badge variant={demand}>{demand.toUpperCase()} FOCUS</Badge>;
};

export const StatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => {
  const labels: Record<TaskStatus, string> = {
    inbox: "INBOX",
    planned: "PLANNED",
    in_progress: "ACTIVE",
    completed: "COMPLETED",
    cancelled: "CANCELLED",
    deferred: "DEFERRED",
  };
  return <Badge variant="status">{labels[status] || status}</Badge>;
};
