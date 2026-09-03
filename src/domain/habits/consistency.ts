import { HabitTargetStatus } from "../models/types";

/**
 * Evaluates the status of a logged habit value against normal and minimum viable targets.
 */
export function evaluateTargetStatus(
  value: number,
  normalTarget: number,
  minimumTarget: number
): HabitTargetStatus {
  if (value <= 0) {
    return "none";
  }
  if (value < minimumTarget) {
    return "none";
  }
  if (value >= minimumTarget && value < normalTarget) {
    return "minimum";
  }
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

  // Weighted score: Normal = 1.0, Minimum = 0.6, Missed = 0
  const totalScore = normalCount * 1.0 + minimumCount * 0.6;
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
