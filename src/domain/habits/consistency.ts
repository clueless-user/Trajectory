import { HabitTargetStatus } from "../models/types";

/**
 * Evaluates the status of a logged habit value against normal and minimum viable targets.
 */
export function evaluateTargetStatus(
  value: number,
  normalTarget: number,
  minimumTarget: number
): HabitTargetStatus {
  // Zero and sub-minimum values both count as "none" — a minimum viable day
  // requires clearing the minimum bar, anything less preserves nothing.
  if (value <= 0) {
    return "none";
  }
  if (value < minimumTarget) {
    return "none";
  }
  if (value >= minimumTarget && value < normalTarget) {
    return "minimum";
  }
  // Normal has a 1.5× ceiling: beyond that the day was exceptional, not just
  // on-target ("exceeded" feeds the same weight as normal in consistency).
  if (value >= normalTarget && value <= normalTarget * 1.5) {
    return "normal";
  }
  return "exceeded";
}

export interface ConsistencyScore {
  totalLoggedDays: number;
  normalDays: number;
  minimumDays: number;
  missedDays: number;
  score: number; // weighted sum
  consistencyPercent: number; // 0 - 100
  trajectoryLabel: string;
}

/**
 * Calculates rolling habit consistency without streak-based guilt mechanics.
 * Minimum viable days are recognized as successful trajectory preservation (weight 0.6).
 */
export function calculateRollingConsistency(
  statuses: HabitTargetStatus[],
  windowDays = 14
): ConsistencyScore {
  let normalCount = 0;
  let minimumCount = 0;
  let missedCount = 0;

  for (const status of statuses) {
    if (status === "normal" || status === "exceeded") {
      normalCount++;
    } else if (status === "minimum") {
      minimumCount++;
    } else {
      missedCount++;
    }
  }

  // Weighted score: Normal = 1.0, Minimum = 0.6, Missed = 0. The 0.6 weight
  // is the product's anti-all-or-nothing stance: a bad day that still clears
  // the minimum bar preserves 60% of the trajectory instead of breaking it.
  const totalScore = normalCount * 1.0 + minimumCount * 0.6;
  // Normalize against the full window (not just logged days) so sparse
  // logging reads as lower consistency, not hidden perfection.
  const maxPossible = Math.max(windowDays, statuses.length);
  const consistencyPercent = Math.min(100, Math.round((totalScore / maxPossible) * 100));

  let trajectoryLabel = "Low Momentum";
  if (consistencyPercent >= 75) {
    trajectoryLabel = "Resilient Trajectory";
  } else if (consistencyPercent >= 45) {
    trajectoryLabel = "Minimum Viable Continuity";
  }

  return {
    totalLoggedDays: statuses.length,
    normalDays: normalCount,
    minimumDays: minimumCount,
    missedDays: missedCount,
    score: totalScore,
    consistencyPercent,
    trajectoryLabel,
  };
}
