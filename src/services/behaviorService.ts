import { TaskRepository } from "../repositories/taskRepository";
import { WorkSessionRepository } from "../repositories/workSessionRepository";
import { EventLogRepository } from "../repositories/eventLogRepository";
import { StateRepository } from "../repositories/stateRepository";
import { HabitRepository } from "../repositories/habitRepository";
import { RabbitHoleRepository } from "../repositories/rabbitHoleRepository";
import { parseEventPayload } from "../domain/events/payloads";
import { addDays } from "../domain/time/date";
import { WeeklyBehaviorFacts, Pattern } from "../domain/behavior/types";
import { estimateFacts } from "../domain/behavior/estimates";
import { planningFacts } from "../domain/behavior/planning";
import { sessionFacts } from "../domain/behavior/sessions";
import { deferralFacts } from "../domain/behavior/deferrals";
import { habitFacts } from "../domain/behavior/habits";
import { rabbitHoleFacts } from "../domain/behavior/rabbitHoles";
import { stateAssociations, DayObservation } from "../domain/behavior/stateAssociations";
import { detectPatterns } from "../domain/behavior/patterns";
import { dateRange, localDateOf, sum } from "../domain/behavior/stats";

const taskRepo = new TaskRepository();
const sessionRepo = new WorkSessionRepository();
const eventLogRepo = new EventLogRepository();
const stateRepo = new StateRepository();
const habitRepo = new HabitRepository();
const rabbitHoleRepo = new RabbitHoleRepository();

/**
 * Composition service for the Weekly Review: gathers week-bounded data from
 * repositories, runs the pure behaviour modules, and assembles a traceable
 * WeeklyBehaviorFacts object. Descriptive only (docs/SEMANTICS.md §9).
 *
 * @param weekStart Monday of the target local week ("YYYY-MM-DD")
 * @param isCurrentWeek true = week still in progress (facts are partial)
 */
export async function buildWeeklyBehaviorFacts(
  weekStart: string,
  isCurrentWeek = false
): Promise<WeeklyBehaviorFacts> {
  const weekEnd = addDays(weekStart, 6);
  const startIso = new Date(`${weekStart}T00:00:00`).toISOString();
  const endIso = new Date(`${addDays(weekStart, 7)}T00:00:00`).toISOString();

  // ---- gather (all queries date-bounded) --------------------------------
  const events = await eventLogRepo.getByDateRange(startIso, endIso);
  const completedTasks = await taskRepo.getTasksCompletedInRange(startIso, endIso);
  const sessions = await sessionRepo.getSessionsInRange(startIso, endIso);
  const habits = await habitRepo.getAllHabits();
  const habitLogs = await habitRepo.getLogsForRange(weekStart, weekEnd);
  const holes = await rabbitHoleRepo.getAllRabbitHoles();

  // Latest trustworthy plan snapshot per day of the week.
  const snapshotEvents = await eventLogRepo.getLatestSnapshotsForRange(startIso, endIso);
  const daySnapshots: Array<{ date: string; available_minutes: number | null; total_planned_minutes: number | null }> = [];
  for (const snap of snapshotEvents) {
    const parsed = parseEventPayload(snap);
    if (parsed.ok) {
      daySnapshots.push({
        date: (parsed.payload.date as string) ?? "",
        available_minutes: (parsed.payload.available_minutes as number | null) ?? null,
        total_planned_minutes: (parsed.payload.total_planned_minutes as number | null) ?? null,
      });
    }
  }

  // Daily state for each day of the week (bounded per-day queries).
  const weekDates = dateRange(weekStart, weekEnd);
  const statesByDate = new Map<string, { energy: number; clarity: number; stress: number; social_battery: number }>();
  for (const date of weekDates) {
    const state = await stateRepo.getDailyState(date);
    if (state) {
      statesByDate.set(date, {
        energy: state.energy,
        clarity: state.clarity,
        stress: state.stress,
        social_battery: state.social_battery,
      });
    }
  }

  // ---- malformed-event bookkeeping --------------------------------------
  const malformed = events.filter((e) => !parseEventPayload(e).ok);

  // ---- domain synthesis ---------------------------------------------------
  const estimates = estimateFacts(completedTasks);
  const exec = sessionFacts(sessions, events);
  const deferrals = deferralFacts(events);

  const deferredMinutes = sum(
    events
      .filter((e) => e.event_type === "task.deferred")
      .map((e) => {
        const p = parseEventPayload(e);
        return p.ok ? ((p.payload.estimated_minutes as number | null) ?? 0) : 0;
      })
  );

  const planning = planningFacts(
    daySnapshots,
    completedTasks,
    exec.totalLoggedMinutes,
    deferredMinutes,
    events.filter((e) => e.event_type === "compression.applied").length
  );

  // Completed estimated work per local day, paired with that day's state.
  const completedMinutesByDate = new Map<string, number>();
  for (const task of completedTasks) {
    if (!task.completed_at) continue;
    const day = localDateOf(task.completed_at);
    completedMinutesByDate.set(day, (completedMinutesByDate.get(day) ?? 0) + (task.estimated_minutes || 0));
  }
  const buildObservations = (pick: (s: { energy: number; clarity: number; stress: number; social_battery: number }) => number): DayObservation[] =>
    [...statesByDate.entries()]
      .map(([date, s]) => ({ date, stateValue: pick(s), completedWork: completedMinutesByDate.get(date) ?? 0 }));

  const associations = [
    stateAssociations("energy", buildObservations((s) => s.energy)),
    stateAssociations("clarity", buildObservations((s) => s.clarity)),
    stateAssociations("stress", buildObservations((s) => s.stress)),
    stateAssociations("socialBattery", buildObservations((s) => s.social_battery)),
  ];

  const habitsWeek = habitFacts(habits, habitLogs, weekDates);

  const tasksCancelled = events.filter((e) => {
    if (e.event_type !== "task.status_changed") return false;
    const p = parseEventPayload(e);
    return p.ok && p.payload.to === "cancelled";
  }).length;

  const execution = { ...exec, tasksCompleted: completedTasks.length, tasksDeferred: deferrals.totalDeferrals, tasksCancelled };

  const patterns: Pattern[] = detectPatterns({
    events,
    estimates,
    planning,
    execution,
    associations,
    habitRecoverySamples: habitsWeek.map((h) => ({
      name: h.name,
      missedDays: h.missedDays,
      recoveryMedianDays: h.recoveryAfterMissMedianDays,
    })),
  });

  // ---- coverage ----------------------------------------------------------
  const eventDays = new Set(events.map((e) => localDateOf(e.created_at)));
  const sessionDays = new Set(sessions.map((s) => localDateOf(s.start_time)));
  const daysWithData = new Set<string>([...eventDays, ...sessionDays, ...statesByDate.keys(), ...daySnapshots.map((s) => s.date)]).size;
  const allEventDates = [...eventDays, ...sessionDays].sort();
  const earliestReliableDate = allEventDates.length > 0 ? allEventDates[0] : null;

  const warnings: string[] = [];
  if (isCurrentWeek) {
    warnings.push("This week is still in progress — the numbers are partial.");
  }
  if (daySnapshots.length < weekDates.length) {
    warnings.push(
      `Plan snapshots exist for ${daySnapshots.length} of ${weekDates.length} days — planned-vs-actual covers only recorded days.`
    );
  }
  if (malformed.length > 0) {
    warnings.push(`${malformed.length} event record(s) had malformed payloads and were excluded.`);
  }
  if (earliestReliableDate && earliestReliableDate > weekStart) {
    warnings.push(`Event history begins ${earliestReliableDate} — earlier days in this week have limited evidence.`);
  }

  return {
    coverage: {
      weekStart,
      weekEnd,
      generatedAt: new Date().toISOString(),
      daysWithData,
      earliestReliableDate,
      warnings,
    },
    execution,
    planning,
    estimates,
    deferrals: deferrals,
    habits: habitsWeek,
    rabbitHoles: rabbitHoleFacts(holes, weekStart, weekEnd),
    stateAssociations: associations,
    patterns,
    provenance: {
      execution: {
        source: "tasks (completed_at range), work_sessions (start_time range), event_log",
        observationCount: completedTasks.length + sessions.length + events.length,
        excludedCount: malformed.length,
      },
      planning: {
        source: "event_log planning.day_snapshot (latest per day), task.completed payloads",
        observationCount: daySnapshots.length,
        excludedCount: weekDates.length - daySnapshots.length,
        note: "days without snapshots are excluded from planned-vs-actual claims",
      },
      estimates: {
        source: "completed tasks with estimated_minutes > 0 and actual_minutes > 0",
        observationCount: estimates.taskCount,
        excludedCount: completedTasks.length - estimates.taskCount,
      },
      habits: {
        source: "habit_logs by date range",
        observationCount: habitLogs.length,
        excludedCount: 0,
      },
      stateAssociations: {
        source: "daily_states joined day-by-day with completed estimated minutes",
        observationCount: statesByDate.size,
        excludedCount: weekDates.length - statesByDate.size,
      },
    },
  };
}
