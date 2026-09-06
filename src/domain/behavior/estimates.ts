import { Task } from "../models/types";
import { EstimateFacts } from "./types";
import { median } from "./stats";

/**
 * Estimate-accuracy thresholds (product spec §10.1 — explicit constants,
 * never hidden magic numbers). A bias label requires enough completed tasks
 * with both estimate and actual to be trustworthy.
 */
export const ESTIMATE_BIAS_MIN_TASKS = 8;

export function estimateFacts(completedTasks: Task[]): EstimateFacts {
  const usable = completedTasks.filter(
    (t) => (t.estimated_minutes ?? 0) > 0 && (t.actual_minutes ?? 0) > 0
  );
  const errors = usable.map((t) => t.actual_minutes - t.estimated_minutes);
  const ratios = usable
    .filter((t) => t.estimated_minutes > 0)
    .map((t) => t.actual_minutes / t.estimated_minutes);

  const medianRatio = median(ratios);
  const bias: EstimateFacts["bias"] =
    usable.length < ESTIMATE_BIAS_MIN_TASKS
      ? "insufficient-data"
      : medianRatio !== null && medianRatio >= 1.25
        ? "over"
        : medianRatio !== null && medianRatio <= 0.8
          ? "under"
          : "mixed";

  return {
    taskCount: usable.length,
    medianErrorMinutes: median(errors),
    medianRatio,
    overEstimateCount: errors.filter((e) => e > 0).length,
    underEstimateCount: errors.filter((e) => e < 0).length,
    bias,
  };
}
