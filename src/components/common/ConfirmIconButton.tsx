import React, { useEffect, useRef, useState } from "react";

const CONFIRM_WINDOW_MS = 3000;

/**
 * Two-step calm confirm icon button (Planner delete pattern): first click
 * morphs to "Delete?" and reverts after ~3s; the second click executes.
 * No browser confirm(), no guilt copy.
 */
export const ConfirmIconButton: React.FC<{
  onConfirm: () => void;
  disabled?: boolean;
  disabledTitle?: string;
  confirmLabel?: string;
  title?: string;
  className?: string;
  children: React.ReactNode; // idle icon
}> = ({
  onConfirm,
  disabled = false,
  disabledTitle = "Not available right now",
  confirmLabel = "Delete?",
  title = "Delete",
  className = "",
  children,
}) => {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return (
    <button
      draggable={false}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        if (!armed) {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
          return;
        }
        if (timer.current) clearTimeout(timer.current);
        setArmed(false);
        onConfirm();
      }}
      title={disabled ? disabledTitle : armed ? "Click again to confirm" : title}
      className={`flex items-center justify-center p-1 rounded transition-colors disabled:cursor-not-allowed ${
        armed
          ? "text-rose-300 bg-rose-950/60 hover:bg-rose-900/60"
          : "text-zinc-600 hover:text-rose-300 hover:bg-zinc-800 disabled:hover:bg-transparent disabled:hover:text-zinc-600"
      } ${className}`}
    >
      {armed ? <span className="text-[10px] font-semibold px-0.5 whitespace-nowrap">{confirmLabel}</span> : children}
    </button>
  );
};
