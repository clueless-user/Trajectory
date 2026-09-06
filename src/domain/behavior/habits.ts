import { Habit, HabitLog } from "../models/types";
import { HabitFacts } from "./types";
import { median } from "./stats";

/**
 * Habit resilience (not streaks): how often targets were met and how quickly
 * the habit reappears after a missed day. Recovery = median gap in days
 * between a missed day and the next logged day.
 */
export function habitFacts(
  habits: Habit[],
  logs: HabitLog[],
  weekDates: string[]
): HabitFacts[] {
  return habits
    .filter((h) => !h.is_archived)
    .map((habit) => {
      // A habit only "owes" days for dates within the window after it existed.
      const createdLocal = habit.created_at.slice(0, 10);
      const applicableDates = weekDates.filter((d) => d >= createdLocal);
      const habitLogs = logs.filter((l) => l.habit_id === habit.id);

      let normalDays = 0;
      let minimumDays = 0;
      const loggedDates = new Set<string>();
      for (const log of habitLogs) {
        loggedDates.add(log.date);
        if (log.target_met_status === "normal" || log.target_met_status === "exceeded") {
          normalDays += 1;
        } else if (log.target_met_status === "minimum") {
          minimumDays += 1;
        }
      }

      const missedDates = applicableDates.filter((d) => !loggedDates.has(d));

      // Recovery: for each missed day, days until the next logged day.
      const recoveryGaps: number[] = [];
      for (const missed of missedDates) {
        const next = [...loggedDates].sort().find((d) => d > missed);
        if (next) {
          recoveryGaps.push(
            Math.round((Date.parse(`${next}T00:00:00Z`) - Date.parse(`${missed}T00:00:00Z`)) / 86400000)
          );
        }
      }

      return {
        habitId: habit.id,
        name: habit.title,
        normalDays,
        minimumDays,
        missedDays: missedDates.length,
        recoveryAfterMissMedianDays: median(recoveryGaps),
      };
    });
}
