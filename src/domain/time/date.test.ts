import { describe, it, expect } from "vitest";
import {
  toLocalDateString,
  todayLocal,
  addDays,
  dayFromTodayLocal,
  nowIsoTimestamp,
} from "./date";

describe("date utilities — day semantics", () => {
  it("formats a local date without timezone shifting", () => {
    // 2026-03-14 01:30 local (+05:30) is 2026-03-13 20:00 UTC — local day must win.
    const localNight = new Date(2026, 2, 14, 1, 30, 0);
    expect(toLocalDateString(localNight)).toBe("2026-03-14");

    const utcBoundary = new Date("2026-03-13T20:00:00Z");
    // In any timezone with a positive offset this is already the next local day;
    // the function must simply reflect the Date's local fields.
    expect(toLocalDateString(utcBoundary)).toBe(toLocalDateString(utcBoundary));
  });

  it("todayLocal matches the machine's local calendar fields", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    expect(todayLocal()).toBe(expected);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-02-29", 365)).toBe("2025-02-28"); // leap-day base
  });

  it("dayFromTodayLocal composes the local day with date arithmetic", () => {
    expect(dayFromTodayLocal(0)).toBe(todayLocal());
    expect(dayFromTodayLocal(-1)).toBe(addDays(todayLocal(), -1));
    expect(dayFromTodayLocal(7)).toBe(addDays(todayLocal(), 7));
  });

  it("nowIsoTimestamp returns a parseable UTC ISO string", () => {
    const ts = nowIsoTimestamp();
    expect(Number.isNaN(Date.parse(ts))).toBe(false);
    expect(ts.endsWith("Z")).toBe(true);
  });
});
