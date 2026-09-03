import { describe, it, expect } from "vitest";
import { formatSeconds, calculateEstimateDelta } from "./timer";

describe("Timer Domain Logic", () => {
  it("formats seconds accurately into MM:SS and HH:MM:SS", () => {
    expect(formatSeconds(0)).toBe("00:00");
    expect(formatSeconds(45)).toBe("00:45");
    expect(formatSeconds(90)).toBe("01:30");
    expect(formatSeconds(3600)).toBe("01:00:00");
    expect(formatSeconds(3725)).toBe("01:02:05");
  });

  it("calculates estimate vs actual delta", () => {
    // 90 minutes actual (5400s), 60 minutes estimate
    const over = calculateEstimateDelta(5400, 60);
    expect(over.diffMinutes).toBe(30);
    expect(over.isOver).toBe(true);
    expect(over.deltaLabel).toBe("+30m over estimate");

    // 40 minutes actual (2400s), 60 minutes estimate
    const under = calculateEstimateDelta(2400, 60);
    expect(under.diffMinutes).toBe(-20);
    expect(under.isOver).toBe(false);
    expect(under.deltaLabel).toBe("20m under estimate");
  });
});
