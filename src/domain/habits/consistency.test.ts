import { describe, it, expect } from "vitest";
import { evaluateTargetStatus, calculateRollingConsistency } from "./consistency";
import { HabitTargetStatus } from "../models/types";

describe("Habit Dual Target & Consistency", () => {
  it("correctly distinguishes 0, 5, 30, 60, 90 mins against normal=60, min=5", () => {
    const normal = 60;
    const min = 5;

    expect(evaluateTargetStatus(0, normal, min)).toBe("none");
    expect(evaluateTargetStatus(4, normal, min)).toBe("none");
    expect(evaluateTargetStatus(5, normal, min)).toBe("minimum");
    expect(evaluateTargetStatus(30, normal, min)).toBe("minimum");
    expect(evaluateTargetStatus(60, normal, min)).toBe("normal");
    expect(evaluateTargetStatus(80, normal, min)).toBe("normal");
    expect(evaluateTargetStatus(100, normal, min)).toBe("exceeded");
  });

  it("rewards minimum viable days in rolling consistency without destructive zero-streaks", () => {
    // User achieved: 5 normal days, 5 minimum days, 4 missed days in 14 days
    const statuses: HabitTargetStatus[] = [
      "normal", "normal", "normal", "normal", "normal",
      "minimum", "minimum", "minimum", "minimum", "minimum",
      "none", "none", "none", "none"
    ];

    const result = calculateRollingConsistency(statuses, 14);
    // Score = 5*1.0 + 5*0.6 = 8.0 out of 14 => 57%
    expect(result.score).toBe(8.0);
    expect(result.consistencyPercent).toBe(57);
    expect(result.trajectoryLabel).toBe("Minimum Viable Continuity");
  });

  it("treats values below the minimum target as none, including negatives", () => {
    expect(evaluateTargetStatus(-5, 60, 5)).toBe("none");
    expect(evaluateTargetStatus(0.5, 60, 5)).toBe("none");
    expect(evaluateTargetStatus(4.9, 60, 5)).toBe("none");
  });

  it("keeps exactly 1.5x the normal target as normal, beyond that as exceeded", () => {
    expect(evaluateTargetStatus(90, 60, 5)).toBe("normal");   // exactly 1.5x
    expect(evaluateTargetStatus(90.1, 60, 5)).toBe("exceeded");
    expect(evaluateTargetStatus(61, 60, 5)).toBe("normal");
  });

  it("handles a minimum target equal to the normal target", () => {
    expect(evaluateTargetStatus(30, 30, 30)).toBe("normal");
    expect(evaluateTargetStatus(29, 30, 30)).toBe("none");
  });

  it("scores an empty history as zero percent with low momentum, never an error", () => {
    const result = calculateRollingConsistency([], 14);
    expect(result.totalLoggedDays).toBe(0);
    expect(result.score).toBe(0);
    expect(result.consistencyPercent).toBe(0);
    expect(result.trajectoryLabel).toBe("Low Momentum");
  });

  it("caps consistency at 100 percent for a perfect history", () => {
    const result = calculateRollingConsistency(new Array(14).fill("normal"), 14);
    expect(result.consistencyPercent).toBe(100);
    expect(result.trajectoryLabel).toBe("Resilient Trajectory");
    expect(result.missedDays).toBe(0);
  });

  it("scores an all-missed window as low momentum without going negative", () => {
    const result = calculateRollingConsistency(new Array(7).fill("none"), 7);
    expect(result.missedDays).toBe(7);
    expect(result.score).toBe(0);
    expect(result.consistencyPercent).toBe(0);
    expect(result.trajectoryLabel).toBe("Low Momentum");
  });

  it("counts exceeded days as normal-weight credit", () => {
    const statuses: HabitTargetStatus[] = ["exceeded", "exceeded", "none", "none"];
    const result = calculateRollingConsistency(statuses, 7);
    // 2 normal-weight days over a 7-day window => 29%
    expect(result.normalDays).toBe(2);
    expect(result.consistencyPercent).toBe(29);
  });

  it("denominates against the longer of window and provided history", () => {
    // 21 logged days supplied against a 7-day window: denominator is 21.
    const result = calculateRollingConsistency(new Array(21).fill("minimum"), 7);
    expect(result.minimumDays).toBe(21);
    expect(result.score).toBe(12.6);
    expect(result.consistencyPercent).toBe(60);
  });

  it("classifies a minimum-heavy history as minimum viable continuity at the 45 boundary", () => {
    // 10 minimum days of 14 => score 6.0 => 43% (below 45 => Low Momentum)
    const below: HabitTargetStatus[] = [...new Array(10).fill("minimum"), ...new Array(4).fill("none")];
    expect(calculateRollingConsistency(below, 14).trajectoryLabel).toBe("Low Momentum");

    // 11 minimum days of 14 => score 6.6 => 47% (at/above 45)
    const at: HabitTargetStatus[] = [...new Array(11).fill("minimum"), ...new Array(3).fill("none")];
    expect(calculateRollingConsistency(at, 14).trajectoryLabel).toBe("Minimum Viable Continuity");
  });
});
