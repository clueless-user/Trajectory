import { Pattern, ExecutionFacts, EstimateFacts, PlanningFacts, StateAssociation } from "./types";
import { repeatedlyDeferredTaskIds } from "./deferrals";
import { EventLogEntry } from "../../repositories/eventLogRepository";
import { localHourOf } from "./stats";

/**
 * Deterministic, descriptive pattern rules. Thresholds are explicit exported
 * constants (product spec §10.1) — no hidden magic numbers, no ML, no
 * causal language ever. Insufficient patterns are produced for provenance
 * but must not be rendered as facts by the UI.
 */
export const PATTERN_THRESHOLDS = {
  ESTIMATE_BIAS_MIN_TASKS: 8,
  TIME_CONCENTRATION_MIN_SESSIONS: 10,
  TIME_CONCENTRATION_MIN_SHARE: 0.7,
  REPEATED_DEFERRAL_MIN: 3,
  OVERLOAD_MIN_DAYS_OF_DATA: 5,
  HABIT_RECOVERY_MIN_MISSES: 2,
} as const;

interface PatternInputs {
  events: EventLogEntry[];
  estimates: EstimateFacts;
  planning: PlanningFacts;
  execution: ExecutionFacts;
  associations: StateAssociation[];
  habitRecoverySamples: Array<{ name: string; missedDays: number; recoveryMedianDays: number | null }>;
}

export function detectPatterns(inputs: PatternInputs): Pattern[] {
  const patterns: Pattern[] = [];
  const t = PATTERN_THRESHOLDS;

  // Estimate bias
  if (inputs.estimates.taskCount >= t.ESTIMATE_BIAS_MIN_TASKS && inputs.estimates.medianRatio !== null) {
    const pct = Math.round(Math.abs(inputs.estimates.medianRatio - 1) * 100);
    patterns.push({
      id: "estimate-bias",
      statement:
        inputs.estimates.medianRatio >= 1
          ? `Tasks took about ${pct}% longer than estimated.`
          : `Tasks took about ${pct}% less time than estimated.`,
      evidenceCount: inputs.estimates.taskCount,
      confidence: "tentative",
    });
  }

  // Time-of-day concentration
  const finishedStarts = inputs.events
    .filter((e) => e.event_type === "session.finished")
    .map((e) => e.created_at);
  if (finishedStarts.length >= t.TIME_CONCENTRATION_MIN_SESSIONS) {
    const before14 = finishedStarts.filter((iso) => localHourOf(iso) < 14).length;
    const share = before14 / finishedStarts.length;
    if (share >= t.TIME_CONCENTRATION_MIN_SHARE || (1 - share) >= t.TIME_CONCENTRATION_MIN_SHARE) {
      const window = share >= t.TIME_CONCENTRATION_MIN_SHARE ? "before 2pm" : "at or after 2pm";
      patterns.push({
        id: "time-concentration",
        statement: `Most completed work happened ${window}.`,
        evidenceCount: finishedStarts.length,
        confidence: "tentative",
      });
    }
  }

  // Deferral recurrence
  const repeated = repeatedlyDeferredTaskIds(inputs.events, t.REPEATED_DEFERRAL_MIN);
  if (repeated.length > 0) {
    patterns.push({
      id: "deferral-recurrence",
      statement:
        repeated.length === 1
          ? "One task was deferred repeatedly during the week."
          : `${repeated.length} tasks were deferred repeatedly during the week.`,
      evidenceCount: repeated.length,
      confidence: "tentative",
    });
  }

  // Overload frequency (needs enough days with planning snapshots)
  if (inputs.planning.daysWithPlanData >= t.OVERLOAD_MIN_DAYS_OF_DATA) {
    patterns.push({
      id: "overload-frequency",
      statement: `The plan exceeded available time on ${inputs.planning.overloadDays} of ${inputs.planning.daysWithPlanData} recorded days.`,
      evidenceCount: inputs.planning.daysWithPlanData,
      confidence: "tentative",
    });
  }

  // Session cadence
  if (inputs.execution.sessionsFinished >= t.TIME_CONCENTRATION_MIN_SESSIONS && inputs.execution.medianSessionMinutes !== null) {
    patterns.push({
      id: "session-cadence",
      statement: `A typical work session ran about ${Math.round(inputs.execution.medianSessionMinutes)} minutes.`,
      evidenceCount: inputs.execution.sessionsFinished,
      confidence: "tentative",
    });
  }

  // Habit recovery
  for (const h of inputs.habitRecoverySamples) {
    if (h.missedDays >= t.HABIT_RECOVERY_MIN_MISSES && h.recoveryMedianDays !== null) {
      patterns.push({
        id: `habit-recovery-${h.name}`,
        statement: `“${h.name}” typically resumed within ${h.recoveryMedianDays} day${h.recoveryMedianDays === 1 ? "" : "s"} after a missed day.`,
        evidenceCount: h.missedDays,
        confidence: "tentative",
      });
    }
  }

  // State associations (only tentative-or-better are surfaced as patterns)
  for (const a of inputs.associations) {
    if (a.confidence !== "insufficient") {
      patterns.push({
        id: `state-association-${a.metric}`,
        statement: a.statement,
        evidenceCount: a.evidenceCount,
        confidence: a.confidence,
      });
    }
  }

  return patterns;
}
