import { EventLogEntry } from "../../repositories/eventLogRepository";
import { DeferralFacts } from "./types";

/**
 * Deferral behaviour from the event log only (current task state cannot show
 * how often something bounced). Descriptive by rule: the word "deferred"
 * never implies procrastination or fault.
 */
export function deferralFacts(events: EventLogEntry[]): DeferralFacts {
  const deferred = events.filter((e) => e.event_type === "task.deferred" && e.entity_id);
  const completedIds = new Set(
    events.filter((e) => e.event_type === "task.completed" && e.entity_id).map((e) => e.entity_id)
  );

  const perTask = new Map<string, number>();
  for (const e of deferred) {
    perTask.set(e.entity_id!, (perTask.get(e.entity_id!) ?? 0) + 1);
  }

  return {
    totalDeferrals: deferred.length,
    uniqueDeferredTasks: perTask.size,
    repeatedDeferralTasks: [...perTask.values()].filter((n) => n > 1).length,
    completedAfterDeferral: [...perTask.keys()].filter((id) => completedIds.has(id)).length,
  };
}

/** IDs deferred at least `times` times within the analysed event window. */
export function repeatedlyDeferredTaskIds(
  events: EventLogEntry[],
  times: number
): string[] {
  const perTask = new Map<string, number>();
  for (const e of events) {
    if (e.event_type === "task.deferred" && e.entity_id) {
      perTask.set(e.entity_id, (perTask.get(e.entity_id) ?? 0) + 1);
    }
  }
  return [...perTask.entries()].filter(([, n]) => n >= times).map(([id]) => id);
}
