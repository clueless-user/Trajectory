import { useEffect, useRef } from "react";
import { todayLocal } from "../domain/time/date";

/**
 * Fires `onRollover` when the local calendar day changes while the app is
 * open (midnight rollover) or when the window regains focus on a new day.
 * Today's stores must reload — "today" is a different day now.
 */
export function useDayRollover(
  getDate: () => string = todayLocal,
  onRollover: () => void
): void {
  const dateRef = useRef(getDate());
  const callbackRef = useRef(onRollover);
  callbackRef.current = onRollover;

  useEffect(() => {
    const check = () => {
      const current = getDate();
      if (current !== dateRef.current) {
        dateRef.current = current;
        callbackRef.current();
      }
    };
    // Interval covers an always-open window sitting across midnight; the
    // focus listener catches machines that slept past midnight (no ticks
    // while suspended, but focus fires on wake).
    const id = setInterval(check, 30_000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", check);
    };
    // getDate is stable in practice; re-subscribing on identity churn adds nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
