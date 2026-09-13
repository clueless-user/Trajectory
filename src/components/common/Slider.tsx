// Labeled range input for subjective state metrics on a 1–10 scale (energy,
// focus, etc.). Integer steps only — half-point self-ratings aren't useful.
// Accent color is applied via Tailwind's `accent-*` utility on the native input.
import React from "react";

interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  color?: "cyan" | "emerald" | "amber" | "purple";
  description?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min = 1,
  max = 10,
  onChange,
  color = "cyan",
  description,
}) => {
  const accentColors = {
    cyan: "accent-cyan-400 text-cyan-300",
    emerald: "accent-emerald-400 text-emerald-300",
    amber: "accent-amber-400 text-amber-300",
    purple: "accent-purple-400 text-purple-300",
  };

  return (
    <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/80">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">{label}</span>
        <span className={`font-mono text-xs font-semibold ${accentColors[color].split(" ")[1]}`}>
          {value}/{max}
        </span>
      </div>
      {description && <span className="text-[10px] text-zinc-500">{description}</span>}
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer ${
          accentColors[color].split(" ")[0]
        }`}
      />
      <div className="flex justify-between text-[9px] text-zinc-600 font-mono">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};
