import { EventPayloadSchemas } from "../events/payloads";

/**
 * Activity classification (Phase 2C): every behavioural event is either
 * "execution" (shipped work), "planning" (organising/deciding), or "neutral"
 * (bookkeeping/dual-logged/bookkeeping-adjacent — excluded from the balance).
 * Descriptive only: the classification feeds the execution-balance readout
 * and nothing else. Semantics: docs/SEMANTICS.md §10.
 */
export type ActivityClass = "execution" | "planning" | "neutral";

/** Every event name the catalogue knows (payload schemas are the source of truth). */
export type EventName = keyof typeof EventPayloadSchemas | GoalEventName;

// goal.* events are Phase 2C additions; their payload schemas live in
// EventPayloadSchemas too, so this union is mostly redundant — kept explicit
// so a schema-key rename cannot silently de-classify an event.
type GoalEventName = "goal.parked" | "goal.acknowledged" | "goal.card_added";

/**
 * Payload-independent classification table. Record<EventName, …> makes an
 * unclassified NEW event a compile error — classification is part of the
 * contract of emitting an event.
 *
 * Dual-log rule: task.completed/task.deferred carry the count themselves, so
 * the generic task.status_changed transitions to completed/deferred are
 * NEUTRAL here to avoid double-counting execution/planning.
 */
const EVENT_CLASS: Record<
  EventName,
  ActivityClass | { statusChanged: "special" }
> = {
  // — execution —
  "task.completed": "execution",
  "session.finished": "execution",
  // status_changed is payload-dependent (from/to), flagged "special":
  "task.status_changed": { statusChanged: "special" },
  // habit.logged is payload-dependent (target_met_status): special too.
  "habit.logged": { statusChanged: "special" },

  // — planning —
  "task.created": "planning",
  "task.quick_capture_created": "planning",
  "task.details_updated": "planning",
  "task.deferred": "planning",
  "compression.applied": "planning",
  "planning.objective_set": "planning",
  "planning.available_minutes_changed": "planning",
  "planning.objective_carried_over": "planning",
  "planning.day_snapshot": "planning",
  "review.saved": "planning",
  "rabbit_hole.converted_task": "planning",
  "goal.card_added": "planning",

  // — neutral (explicit, per docs/SEMANTICS.md §10) —
  "session.started": "neutral",
  "session.paused": "neutral",
  "session.resumed": "neutral",
  "session.cancelled": "neutral",
  "session.recovered_interrupted": "neutral",
  "session.discarded": "neutral",
  "session.resumed_after_interrupt": "neutral",
  "task.deleted": "neutral",
  "rabbit_hole.captured": "neutral",
  "rabbit_hole.archived": "neutral",
  "goal.parked": "neutral",
  "goal.acknowledged": "neutral",
};

/** Fail fast outside production: an unclassified event is an emission bug. */
const STRICT = import.meta.env?.DEV !== false;

/**
 * Classify one event. Payload-dependent cases read only what their typed
 * schema guarantees; anything malformed degrades to the payload-independent
 * default for that event type.
 */
export function classifyEvent(
  eventType: string,
  payload?: Record<string, unknown> | null
): ActivityClass {
  const entry = (EVENT_CLASS as Record<string, ActivityClass | { statusChanged: "special" }>)[
    eventType
  ];

  if (entry === undefined) {
    // Unknown type: emission typo or future event read by older code.
    if (STRICT) {
      throw new Error(`classifyEvent: unclassified event type "${eventType}"`);
    }
    console.warn(`classifyEvent: unknown event type "${eventType}" treated as neutral`);
    return "neutral";
  }

  if (typeof entry === "string") return entry;

  // Payload-dependent cases.
  if (eventType === "task.status_changed") {
    const to = payload?.to;
    const from = payload?.from;
    // planned → in_progress is work starting: execution. Moving TO planned is
    // scheduling: planning. to=completed/deferred are dual-logged by the
    // dedicated task.completed/task.deferred events → neutral here.
    if (to === "in_progress" && from === "planned") return "execution";
    if (to === "planned") return "planning";
    return "neutral";
  }

  if (eventType === "habit.logged") {
    // Logging a miss (target_met_status "none") is bookkeeping, not shipped work.
    return payload?.target_met_status === "none" ? "neutral" : "execution";
  }

  // Unreachable: the "special" marker is only used for the two cases above.
  return "neutral";
}

/** All classified event names (for exhaustiveness tests). */
export function classifiedEventNames(): EventName[] {
  return Object.keys(EVENT_CLASS) as EventName[];
}
