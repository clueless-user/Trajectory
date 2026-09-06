import { StateAssociation } from "./types";
import { median } from "./stats";

/** Minimum paired days before any association claim is made at all. */
export const STATE_ASSOCIATION_MIN_PAIRS = 10;
/** Minimum days in each high/low bucket for a presentable association. */
export const STATE_ASSOCIATION_MIN_PER_BUCKET = 5;

export interface DayObservation {
  date: string;
  stateValue: number; // 1-10 scale
  completedWork: number; // minutes of completed estimated work that day
}

type Metric = StateAssociation["metric"];

const METRIC_LABELS: Record<Metric, string> = {
  energy: "energy",
  clarity: "mental clarity",
  stress: "stress",
  socialBattery: "social battery",
};

/**
 * Observational, day-level association between recorded state and completed
 * work. Median-split into high/low days; strictly associational wording.
 * Returns at most one association per metric, or an entry with confidence
 * "insufficient" (which the UI hides — it is kept in the facts for provenance).
 */
export function stateAssociations(
  metric: Metric,
  observations: DayObservation[]
): StateAssociation {
  const label = METRIC_LABELS[metric];
  if (observations.length < STATE_ASSOCIATION_MIN_PAIRS) {
    return {
      metric,
      statement: `Not enough days with recorded ${label} to describe an association.`,
      evidenceCount: observations.length,
      confidence: "insufficient",
    };
  }

  const split = median(observations.map((o) => o.stateValue)) ?? 0;
  const high = observations.filter((o) => o.stateValue > split);
  const low = observations.filter((o) => o.stateValue <= split);

  // "supported" is reserved for longitudinal evidence beyond Phase 2B's
  // single-week scope; a week's data is always at most tentative.
  const confidence: StateAssociation["confidence"] =
    high.length < STATE_ASSOCIATION_MIN_PER_BUCKET ||
    low.length < STATE_ASSOCIATION_MIN_PER_BUCKET
      ? "insufficient"
      : "tentative";

  const avg = (xs: DayObservation[]) =>
    xs.length === 0 ? 0 : xs.reduce((a, o) => a + o.completedWork, 0) / xs.length;

  const highAvg = avg(high);
  const lowAvg = avg(low);
  if (highAvg === lowAvg) {
    return {
      metric,
      statement: `Completed work was similar on higher- and lower-${label} days.`,
      evidenceCount: observations.length,
      confidence,
    };
  }
  const direction = highAvg > lowAvg ? "more" : "less";
  return {
    metric,
    statement: `Higher-${label} days were associated with ${direction} completed work.`,
    evidenceCount: observations.length,
    confidence,
  };
}
