/**
 * WeeklyBehaviorFacts — the stable contract between the behaviour layer and
 * the Weekly Review UI (docs/SEMANTICS.md §9, product spec §8). The UI renders
 * this structure only; all aggregation lives in src/domain/behavior/* and
 * src/services/behaviorService.ts.
 *
 * Phase 2B is strictly descriptive: every claim carries evidence, sparse data
 * is explicit, and nothing here implies causality, prediction, or worth.
 */

export type Confidence = "insufficient" | "tentative" | "supported";

export interface ProvenanceEntry {
  source: string; // tables / event types the fact derives from
  observationCount: number;
  excludedCount: number;
  note?: string;
}

export interface Coverage {
  weekStart: string; // Monday, local
  weekEnd: string; // Sunday, local
  generatedAt: string; // UTC instant
  daysWithData: number;
  earliestReliableDate: string | null;
  warnings: string[];
}

export interface ExecutionFacts {
  tasksCompleted: number;
  tasksDeferred: number;
  tasksCancelled: number;
  sessionsStarted: number;
  sessionsFinished: number;
  sessionsInterrupted: number;
  sessionsAbandoned: number | null; // null = evidence unavailable (pre-2B log)
  totalLoggedMinutes: number;
  medianSessionMinutes: number | null;
  interruptions: number;
}

export interface PlanningFacts {
  plannedMinutes: number | null; // null = no trustworthy snapshots in range
  completedEstimatedMinutes: number;
  loggedWorkMinutes: number;
  remainingEstimatedMinutes: number | null;
  deferredEstimatedMinutes: number;
  overloadDays: number;
  daysWithPlanData: number;
  compressionCount: number;
}

export interface EstimateFacts {
  taskCount: number; // completed tasks with both estimate and actual
  medianErrorMinutes: number | null;
  medianRatio: number | null;
  overEstimateCount: number;
  underEstimateCount: number;
  bias: "over" | "under" | "mixed" | "insufficient-data";
}

export interface DeferralFacts {
  totalDeferrals: number;
  uniqueDeferredTasks: number;
  repeatedDeferralTasks: number; // deferred more than once in the week
  completedAfterDeferral: number;
}

export interface HabitFacts {
  habitId: string;
  name: string;
  normalDays: number; // met normal_target
  minimumDays: number; // met minimum_target but not normal
  missedDays: number; // days the habit existed, in-window, with no log or zero
  recoveryAfterMissMedianDays: number | null;
}

export interface RabbitHoleFacts {
  captured: number;
  converted: number;
  archived: number;
}

export interface StateAssociation {
  metric: "energy" | "clarity" | "stress" | "socialBattery";
  statement: string;
  evidenceCount: number;
  confidence: Confidence;
}

export interface Pattern {
  id: string;
  statement: string;
  evidenceCount: number;
  confidence: Confidence;
}

export interface WeeklyBehaviorFacts {
  coverage: Coverage;
  execution: ExecutionFacts;
  planning: PlanningFacts;
  estimates: EstimateFacts;
  deferrals: DeferralFacts;
  habits: HabitFacts[];
  rabbitHoles: RabbitHoleFacts;
  stateAssociations: StateAssociation[];
  patterns: Pattern[];
  // Traceability: how each numbers block was produced (spec §13).
  provenance: Record<string, ProvenanceEntry>;
}
