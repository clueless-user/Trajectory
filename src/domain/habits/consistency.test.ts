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
});
