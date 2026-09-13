import { describe, it, expect } from "vitest";
import {
  classifyEvent,
  classifiedEventNames,
} from "./activityClass";
import { EventPayloadSchemas } from "../events/payloads";

describe("activity classification (Phase 2C)", () => {
  it("classifies EVERY catalogue event name (exhaustive)", () => {
    const catalogueNames = Object.keys(EventPayloadSchemas);
    const classified = classifiedEventNames();
    for (const name of catalogueNames) {
      // Must not throw (strict mode) — every catalogue name is classified.
      expect(() => classifyEvent(name)).not.toThrow();
      expect(classified).toContain(name as never);
    }
  });

  it("throws on unknown/unclassified types (fail-fast in dev)", () => {
    expect(() => classifyEvent("totally.made_up")).toThrow(/unclassified event type/);
  });

  it("follows the normative decision table", () => {
    // execution
    expect(classifyEvent("task.completed")).toBe("execution");
    expect(classifyEvent("session.finished")).toBe("execution");
    expect(
      classifyEvent("task.status_changed", { from: "planned", to: "in_progress" })
    ).toBe("execution");
    expect(classifyEvent("habit.logged", { target_met_status: "normal" })).toBe("execution");
    expect(classifyEvent("habit.logged", { target_met_status: "minimum" })).toBe("execution");
    expect(classifyEvent("habit.logged", { target_met_status: "exceeded" })).toBe("execution");

    // planning
    expect(classifyEvent("task.created")).toBe("planning");
    expect(classifyEvent("task.quick_capture_created")).toBe("planning");
    expect(classifyEvent("task.details_updated")).toBe("planning");
    expect(classifyEvent("compression.applied")).toBe("planning");
    expect(classifyEvent("planning.objective_set")).toBe("planning");
    expect(classifyEvent("planning.day_snapshot")).toBe("planning");
    expect(classifyEvent("review.saved")).toBe("planning");
    expect(classifyEvent("rabbit_hole.converted_task")).toBe("planning");
    expect(
      classifyEvent("task.status_changed", { from: "inbox", to: "planned" })
    ).toBe("planning");
    expect(classifyEvent("task.deferred")).toBe("planning");
    expect(classifyEvent("goal.card_added")).toBe("planning");

    // neutral
    expect(classifyEvent("session.started")).toBe("neutral");
    expect(classifyEvent("session.paused")).toBe("neutral");
    expect(classifyEvent("session.cancelled")).toBe("neutral");
    expect(classifyEvent("session.resumed_after_interrupt")).toBe("neutral");
    expect(classifyEvent("task.deleted")).toBe("neutral");
    expect(classifyEvent("rabbit_hole.captured")).toBe("neutral");
    expect(classifyEvent("rabbit_hole.archived")).toBe("neutral");
    expect(classifyEvent("habit.logged", { target_met_status: "none" })).toBe("neutral");
    expect(classifyEvent("goal.parked")).toBe("neutral");
    expect(classifyEvent("goal.acknowledged")).toBe("neutral");
  });

  it("dual-log dedupe: a completion counts ONCE as execution", () => {
    // Completing a task emits task.status_changed (to=completed) AND
    // task.completed. Only the dedicated event may count.
    const emitted = [
      { type: "task.status_changed", payload: { from: "planned", to: "completed" } },
      { type: "task.completed", payload: {} },
    ].map((e) => classifyEvent(e.type, e.payload));
    expect(emitted.filter((c) => c === "execution")).toHaveLength(1);
    expect(emitted.filter((c) => c === "planning")).toHaveLength(0);

    // Same for deferral → planning once.
    const deferred = [
      { type: "task.status_changed", payload: { from: "planned", to: "deferred" } },
      { type: "task.deferred", payload: {} },
    ].map((e) => classifyEvent(e.type, e.payload));
    expect(deferred.filter((c) => c === "planning")).toHaveLength(1);
  });

  it("in_progress transition from non-planned sources is neutral (conservative)", () => {
    // from=in_progress→in_progress or unknown-from: not provably work-starting.
    expect(
      classifyEvent("task.status_changed", { from: "deferred", to: "in_progress" })
    ).toBe("neutral");
  });
});
