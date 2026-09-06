import React from "react";

interface DualTargetProgressBarProps {
  current: number;
  normalTarget: number;
  minimumTarget: number;
  unit?: string;
  className?: string;
}

export const DualTargetProgressBar: React.FC<DualTargetProgressBarProps> = ({
  current,
  normalTarget,
  minimumTarget,
  unit = "min",
  className = "",
}) => {
  const maxScale = Math.max(normalTarget * 1.2, current, minimumTarget * 2);
  const currentPct = Math.min(100, Math.round((current / maxScale) * 100));
  const minPct = Math.min(100, Math.round((minimumTarget / maxScale) * 100));
  const normPct = Math.min(100, Math.round((normalTarget / maxScale) * 100));

  const isMetNormal = current >= normalTarget;
  const isMetMinimum = current >= minimumTarget;

  let barColor = "bg-zinc-600";
  if (isMetNormal) barColor = "bg-emerald-500";
  else if (isMetMinimum) barColor = "bg-cyan-500";

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      <div className="relative w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
        {/* Progress fill */}
        <div
          className={`h-full transition-all duration-300 rounded-full ${barColor}`}
          style={{ width: `${currentPct}%` }}
        />
        {/* Minimum target marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-cyan-300 z-10 opacity-70"
          style={{ left: `${minPct}%` }}
          title={`Min target: ${minimumTarget} ${unit}`}
        />
        {/* Normal target marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-emerald-300 z-10 opacity-70"
          style={{ left: `${normPct}%` }}
          title={`Normal target: ${normalTarget} ${unit}`}
        />
      </div>
      <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono">
        <span className="font-semibold text-zinc-200">
          {current} {unit}
        </span>
        <div className="flex gap-2 text-zinc-500">
          <span>Min: {minimumTarget}</span>
          <span>Target: {normalTarget}</span>
        </div>
      </div>
    </div>
  );
};

interface WorkloadBarProps {
  committedMinutes: number;
  availableMinutes: number;
  onCompressClick?: () => void;
}

export const WorkloadBar: React.FC<WorkloadBarProps> = ({
  committedMinutes,
  availableMinutes,
  onCompressClick,
}) => {
  const percent = Math.round((committedMinutes / Math.max(1, availableMinutes)) * 100);
  const isOverloaded = committedMinutes > availableMinutes;
  const overflowMinutes = Math.max(0, committedMinutes - availableMinutes);

  return (
    // Outer card rhythm matches the other right-column cards (p-4/gap-3, V-7);
    // bar internals untouched.
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-300">Daily Workload</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
              isOverloaded
                ? "bg-rose-950/70 text-rose-300 border border-rose-800/80"
                : "bg-emerald-950/70 text-emerald-300 border border-emerald-800/80"
            }`}
          >
            {percent}% CAPACITY
          </span>
        </div>
        <span className="font-mono text-xs text-zinc-400">
          {committedMinutes}m / {availableMinutes}m
        </span>
      </div>

      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isOverloaded ? "bg-rose-500" : "bg-emerald-500"
          }`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>

      {isOverloaded && (
        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
          <span className="text-[11px] text-rose-300">
            Overloaded by {Math.floor(overflowMinutes / 60)}h {overflowMinutes % 60}m.
          </span>
          {onCompressClick && (
            <button
              onClick={onCompressClick}
              className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
            >
              Compress Day Plan
            </button>
          )}
        </div>
      )}
    </div>
  );
};
