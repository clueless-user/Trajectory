import { WorkSession } from "../models/types";
import { EventLogEntry } from "../../repositories/eventLogRepository";
import { ExecutionFacts } from "./types";
import { median, sum } from "./stats";

/**
 * Execution/session facts. Sessions are attributed to their start local date
 * by the caller's range query. A finished session's duration counts only
 * running time; cancelled sessions never happened (excluded from duration
 * facts but their events remain as evidence of abandonment).
 */
export function sessionFacts(
  sessions: WorkSession[],
  events: EventLogEntry[]
): ExecutionFacts {
  const finishedSessions = sessions.filter((s) => s.completed_state === "finished");
  const interruptedSessions = sessions.filter((s) => s.completed_state === "interrupted");
  const durations = finishedSessions.map((s) => s.duration_seconds / 60);

  const startedIds = new Set(
    events.filter((e) => e.event_type === "session.started").map((e) => e.entity_id)
  );
  const resolvedIds = new Set(
    events
      .filter((e) =>
        ["session.finished", "session.cancelled", "session.recovered_interrupted"].includes(
          e.event_type
        )
      )
      .map((e) => e.entity_id)
  );
  // Abandoned = started but never resolved. Only claimable when the week had
  // started events at all (pre-instrumentation weeks report null).
  const abandoned = startedIds.size > 0
    ? [...startedIds].filter((id) => id !== null && !resolvedIds.has(id)).length
    : null;

  return {
    tasksCompleted: 0, // filled by the service from task facts
    tasksDeferred: 0,
    tasksCancelled: 0,
    sessionsStarted: sessions.length,
    sessionsFinished: finishedSessions.length,
    sessionsInterrupted: interruptedSessions.length,
    sessionsAbandoned: abandoned,
    totalLoggedMinutes: Math.round(sum(sessions.map((s) => s.duration_seconds / 60))),
    medianSessionMinutes: median(durations),
    interruptions: sum(finishedSessions.map((s) => s.interruption_count)) + sum(interruptedSessions.map((s) => s.interruption_count)),
  };
}
