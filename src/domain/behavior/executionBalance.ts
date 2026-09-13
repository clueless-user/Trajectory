import { classifyEvent } from "./activityClass";
import { EventLogEntry } from "../../repositories/eventLogRepository";
import { localDateOf, dateRange } from "./stats";
import { addDays } from "../time/date";

/**
 * Execution balance (Phase 2C): of the events that are either execution or
 * planning, what share was shipped work? Descriptive calibration — never a
 * score, never coloured, never judged (docs/SEMANTICS.md §10.2).
 *
 * ratio = execution / (execution + planning); neutral events are excluded
 * from the denominator entirely.
 */

/** Days with fewer active events than this show "—" (too sparse to mean anything). */
export const OUTPUT_RATIO_MIN_DAY_EVENTS = 4;
/** Weeks with fewer active events than this suppress the readout entirely. */
export const OUTPUT_RATIO_MIN_WEEK_EVENTS = 10;

export interface DayBalance {
  date: string; // local day
  execution: number;
  planning: number;
  /** execution / (execution + planning), 0..1 — null below the day minimum. */
  ratio: number | null;
}

export interface ExecutionBalance {
  perDay: DayBalance[];
  weekExecution: number;
  weekPlanning: number;
  /** Week-level ratio — null when the week is below the event minimum. */
  weekRatio: number | null;
  /**
   * Present only when the week meets the minimum:
   * "Execution balance — {x} of {y} active events this week were shipped work."
   */
  readout: string | null;
  /** Honest suppression note when the week is too sparse. */
  suppressedReason: string | null;
}

export function executionBalance(
  events: EventLogEntry[],
  weekStart: string,
  parsedPayloads?: Map<string, Record<string, unknown>>
): ExecutionBalance {
  const days = dateRange(weekStart, addDays(weekStart, 6));

  // Classify every in-week event and bucket by local day. Malformed/unknown
  // payloads classify by type alone; classification never throws here
  // (catalogue names are all classified).
  const byDay = new Map<string, { execution: number; planning: number }>();
  let weekExecution = 0;
  let weekPlanning = 0;

  for (const event of events) {
    const payload = parsedPayloads?.get(event.id) ?? safeParse(event.payload);
    const cls = classifyEvent(event.event_type, payload);
    if (cls === "neutral") continue;
    const day = localDateOf(event.created_at);
    if (!days.includes(day)) continue; // defensive: query is already bounded
    const bucket = byDay.get(day) ?? { execution: 0, planning: 0 };
    bucket[cls] += 1;
    byDay.set(day, bucket);
    if (cls === "execution") weekExecution += 1;
    else weekPlanning += 1;
  }

  const perDay: DayBalance[] = days.map((date: string) => {
    const b = byDay.get(date) ?? { execution: 0, planning: 0 };
    const active = b.execution + b.planning;
    return {
      date,
      execution: b.execution,
      planning: b.planning,
      ratio: active >= OUTPUT_RATIO_MIN_DAY_EVENTS ? b.execution / active : null,
    };
  });

  const weekActive = weekExecution + weekPlanning;
  const meetsMinimum = weekActive >= OUTPUT_RATIO_MIN_WEEK_EVENTS;

  return {
    perDay,
    weekExecution,
    weekPlanning,
    weekRatio: meetsMinimum ? weekExecution / weekActive : null,
    readout: meetsMinimum
      ? `Execution balance — ${weekExecution} of ${weekActive} active events this week were shipped work.`
      : null,
    suppressedReason: meetsMinimum
      ? null
      : "Not enough active events this week to compute execution balance.",
  };
}

function safeParse(text: string | null): Record<string, unknown> {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
