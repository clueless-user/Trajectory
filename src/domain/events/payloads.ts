import { z } from "zod";
import type { EventLogEntry } from "../../repositories/eventLogRepository";

/**
 * Typed event payloads for behavioural synthesis (Phase 2B).
 *
 * The event log was historically write-only telemetry; Phase 2B turns it into
 * an analytics input, so payloads get schemas. Events are parsed DEFENSIVELY:
 * historical/foreign rows must never crash a read. Known fields are typed,
 * unknown fields pass through, and every field is optional because older
 * events may predate a payload addition (e.g. session.cancelled gained
 * duration_seconds in Phase 2B).
 */
export const EventPayloadSchemas = {
  "task.created": z
    .object({
      title: z.string().optional(),
      importance: z.string().optional(),
      status: z.string().optional(),
      source: z.string().optional(),
    })
    .passthrough(),
  "task.quick_capture_created": z.object({ title: z.string().optional() }).passthrough(),
  "task.status_changed": z
    .object({
      from: z.string().nullable().optional(),
      to: z.string().optional(),
      source: z.string().optional(),
      via: z.string().optional(),
    })
    .passthrough(),
  "task.details_updated": z.object({ title: z.string().optional() }).passthrough(),
  "task.completed": z
    .object({
      estimated_minutes: z.number().nullish(),
      scheduled_date: z.string().nullish(),
    })
    .passthrough(),
  "task.deferred": z
    .object({
      estimated_minutes: z.number().nullish(),
      scheduled_date: z.string().nullish(),
      via: z.string().optional(),
    })
    .passthrough(),
  "session.started": z.object({ task_id: z.string().nullish() }).passthrough(),
  "session.paused": z.object({}).passthrough(),
  "session.resumed": z.object({}).passthrough(),
  "session.finished": z
    .object({
      duration_seconds: z.number().optional(),
      completed_task: z.boolean().optional(),
      interruption_count: z.number().optional(),
    })
    .passthrough(),
  "session.cancelled": z.object({ duration_seconds: z.number().nullish() }).passthrough(),
  "session.recovered_interrupted": z.object({}).passthrough(),
  "session.discarded": z.object({}).passthrough(),
  "session.resumed_after_interrupt": z.object({ task_id: z.string().nullish() }).passthrough(),
  "compression.applied": z
    .object({
      date: z.string().optional(),
      deferred_count: z.number().optional(),
      deferred_minutes: z.number().optional(),
    })
    .passthrough(),
  "planning.day_snapshot": z
    .object({
      date: z.string().optional(),
      available_minutes: z.number().optional(),
      primary_objective: z.string().nullish(),
      total_planned_minutes: z.number().nullish(),
      planned_tasks: z
        .array(
          z.object({
            task_id: z.string(),
            title: z.string().optional(),
            status: z.string().optional(),
            importance: z.string().optional(),
            cognitive_demand: z.string().optional(),
            estimated_minutes: z.number().nullish(),
          })
        )
        .optional(),
      snapshot_reason: z.string().optional(),
    })
    .passthrough(),
  "planning.objective_set": z
    .object({ date: z.string().optional(), objective: z.string().nullish() })
    .passthrough(),
  "planning.available_minutes_changed": z
    .object({ date: z.string().optional(), minutes: z.number().optional() })
    .passthrough(),
  "planning.objective_carried_over": z
    .object({ date: z.string().optional(), source: z.string().optional() })
    .passthrough(),
  "habit.logged": z
    .object({
      date: z.string().optional(),
      value: z.number().nullish(),
      target_met_status: z.string().nullish(),
    })
    .passthrough(),
  "review.saved": z.object({ date: z.string().optional() }).passthrough(),
  // Phase 2C goal lifecycle (unlinked-goal blind-spot detection). Defensively
  // parsed like every other payload; `goal.card_added` exists only if the
  // task row exists (atomicity rule).
  // rabbit_hole.* statuses (event_type derived from the status value — see
  // SEMANTICS §6); they were catalogue events without schemas until 2C.
  "rabbit_hole.captured": z
    .object({ active_task_id: z.string().nullish() })
    .passthrough(),
  "rabbit_hole.converted_task": z
    .object({ converted_id: z.string().nullish() })
    .passthrough(),
  "rabbit_hole.archived": z.object({}).passthrough(),
  "task.deleted": z
    .object({ title: z.string().nullish() })
    .passthrough(),
  "goal.parked": z
    .object({ goal_id: z.string().optional(), parked_until: z.string().optional() })
    .passthrough(),
  "goal.acknowledged": z.object({ goal_id: z.string().optional() }).passthrough(),
  "goal.card_added": z
    .object({ goal_id: z.string().optional(), task_id: z.string().optional() })
    .passthrough(),
} as const;

export type KnownEventType = keyof typeof EventPayloadSchemas;

export type ParsedEventPayload =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; warning: string };

/**
 * Defensively parse an event's payload against its typed schema. Unknown
 * event types pass through unvalidated (forward compatibility). Malformed
 * payloads for known types yield a warning, never an exception — data
 * quality issues surface as coverage warnings, not crashes.
 */
export function parseEventPayload(entry: EventLogEntry): ParsedEventPayload {
  const schema = (EventPayloadSchemas as Record<string, z.ZodTypeAny | undefined>)[
    entry.event_type
  ];
  if (!schema) {
    return { ok: true, payload: safeJson(entry.payload) };
  }
  if (entry.payload === null || entry.payload === "") {
    return { ok: false, warning: `missing payload for ${entry.event_type}` };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(entry.payload);
  } catch {
    return { ok: false, warning: `unparseable payload for ${entry.event_type}` };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    return { ok: false, warning: `payload schema mismatch for ${entry.event_type} (${detail})` };
  }
  return { ok: true, payload: result.data as Record<string, unknown> };
}

function safeJson(text: string | null): Record<string, unknown> {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
