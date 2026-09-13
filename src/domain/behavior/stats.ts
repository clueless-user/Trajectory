// Aggregation helpers for the Phase 2B behaviour domain. All attribution is
// LOCAL calendar day based (docs/SEMANTICS.md §9.3): UTC instants from stored
// timestamps are converted through the user's timezone here, never by raw
// ISO-string slicing (G-01).
import { toLocalDateString } from "../time/date";

/** Median of numeric list; null for empty input. Outlier-robust by design. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/** Local calendar day ("YYYY-MM-DD") of a UTC ISO instant. */
export function localDateOf(iso: string): string {
  return toLocalDateString(new Date(iso));
}

/** Local hour (0-23) of a UTC ISO instant. */
export function localHourOf(iso: string): number {
  return new Date(iso).getHours();
}

/** All local dates from start to end inclusive (both "YYYY-MM-DD"). */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    out.push(cursor);
    const next = new Date(Date.parse(`${cursor}T00:00:00Z`) + 24 * 60 * 60 * 1000);
    cursor = next.toISOString().split("T")[0];
  }
  return out;
}
