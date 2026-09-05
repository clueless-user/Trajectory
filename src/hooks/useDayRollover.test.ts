import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDayRollover } from "./useDayRollover";

describe("useDayRollover — midnight under an open app", () => {
  let currentDate: string;
  const getDate = () => currentDate;

  beforeEach(() => {
    vi.useFakeTimers();
    currentDate = "2026-09-05";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires the reload callback when the local day changes", () => {
    const onRollover = vi.fn();
    renderHook(() => useDayRollover(getDate, onRollover));

    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(onRollover).not.toHaveBeenCalled(); // same day → nothing

    act(() => {
      currentDate = "2026-09-06"; // midnight passes
      vi.advanceTimersByTime(31_000);
    });
    expect(onRollover).toHaveBeenCalledTimes(1);
  });

  it("fires once per rollover, not repeatedly", () => {
    const onRollover = vi.fn();
    renderHook(() => useDayRollover(getDate, onRollover));

    act(() => {
      currentDate = "2026-09-06";
      vi.advanceTimersByTime(31_000 * 3);
    });
    expect(onRollover).toHaveBeenCalledTimes(1);
  });
});
