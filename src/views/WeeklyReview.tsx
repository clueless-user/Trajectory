import React, { useCallback, useEffect, useState } from "react";
import { buildWeeklyBehaviorFacts } from "../services/behaviorService";
import { WeeklyBehaviorFacts } from "../domain/behavior/types";
import { addDays, todayLocal, weekStart as weekStartOf } from "../domain/time/date";
import { formatMinutes } from "../domain/metrics";
import { CalendarRange, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

/**
 * Weekly Review — the Phase 2B deliverable. Renders the structured
 * WeeklyBehaviorFacts object only: four calm sections, no charts, no advice,
 * no moralizing. Sparse data is stated honestly (docs/SEMANTICS.md §9).
 */
export const WeeklyReview: React.FC = () => {
  // Default: the last COMPLETED week (current in-progress week is opt-in).
  const [weekStart, setWeekStart] = useState<string>(() => addDays(weekStartOf(todayLocal()), -7));
  const [facts, setFacts] = useState<WeeklyBehaviorFacts | null>(null);
  const [loading, setLoading] = useState(true);

  const currentWeekStart = weekStartOf(todayLocal());
  const isCurrentWeek = weekStart === currentWeekStart;

  const load = useCallback(async (ws: string) => {
    setLoading(true);
    try {
      setFacts(await buildWeeklyBehaviorFacts(ws, ws === weekStartOf(todayLocal())));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(weekStart);
  }, [weekStart, load]);

  const canGoNewer = weekStart < currentWeekStart;

  return (
    <div className="flex flex-col gap-5">
      {/* Week selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 font-semibold uppercase tracking-wider">
          <CalendarRange className="w-4 h-4" />
          <span>
            Week of {weekStart}
            {isCurrentWeek && <span className="text-amber-400"> · week in progress</span>}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="Previous week"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            aria-label="Next week"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30"
            disabled={!canGoNewer}
            onClick={() => setWeekStart((w) => addDays(w, 7))}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-zinc-500 p-5">
          <Loader2 className="w-4 h-4 animate-spin" /> Assembling the week…
        </div>
      )}

      {!loading && facts && <WeeklySections facts={facts} isCurrentWeek={isCurrentWeek} />}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string | null; muted?: boolean }> = ({
  label,
  value,
  muted,
}) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-xs text-zinc-400">{label}</span>
    <span className={`text-xs font-mono ${muted ? "text-zinc-500" : "text-zinc-100"}`}>
      {value ?? "—"}
    </span>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800">
    <div className="text-xs font-mono text-zinc-300 font-semibold uppercase tracking-wider mb-2">
      {title}
    </div>
    <div className="divide-y divide-zinc-800/60">{children}</div>
  </div>
);

const WeeklySections: React.FC<{ facts: WeeklyBehaviorFacts; isCurrentWeek: boolean }> = ({
  facts,
  isCurrentWeek,
}) => {
  const { coverage, execution, planning, estimates, deferrals } = facts;
  const empty = execution.sessionsStarted === 0 && execution.tasksCompleted === 0 && deferrals.totalDeferrals === 0;

  if (empty && !isCurrentWeek) {
    return (
      <div className="py-10 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
        No recorded activity this week — nothing to summarize yet.
      </div>
    );
  }

  const estimateError =
    estimates.medianRatio !== null
      ? `${estimates.medianRatio >= 1 ? "+" : "−"}${Math.round(Math.abs(estimates.medianRatio - 1) * 100)}%`
      : null;

  const finishedRate =
    execution.sessionsStarted > 0
      ? `${Math.round((execution.sessionsFinished / execution.sessionsStarted) * 100)}%`
      : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Coverage warnings — honest sparse-data reporting, always visible */}
      {(coverage.warnings.length > 0 || isCurrentWeek) && (
        <div className="flex flex-col gap-1 p-4 rounded-xl bg-zinc-900/40 border border-amber-900/40 text-[11px] text-zinc-400">
          {isCurrentWeek && (
            <span className="text-amber-400/90">This week is still in progress — the numbers below are partial.</span>
          )}
          {coverage.warnings
            .filter((w) => !w.startsWith("This week"))
            .map((w) => (
              <span key={w}>{w}</span>
            ))}
        </div>
      )}

      <Section title="This Week">
        <Row label="Planned" value={planning.plannedMinutes === null ? "no plan records" : formatMinutes(planning.plannedMinutes)} muted={planning.plannedMinutes === null} />
        <Row label="Completed (estimated)" value={formatMinutes(planning.completedEstimatedMinutes)} />
        <Row label="Logged work" value={formatMinutes(execution.totalLoggedMinutes)} />
        <Row label="Data coverage" value={`${coverage.daysWithData}/7 days`} />
      </Section>

      <Section title="Planning">
        <Row
          label="Estimate error (median)"
          value={estimateEstimateLabel(estimates, estimateError)}
          muted={estimates.bias === "insufficient-data"}
        />
        <Row label="Plan exceeded available time" value={`${planning.overloadDays}/${planning.daysWithPlanData || 0} recorded days`} muted={planning.daysWithPlanData === 0} />
        <Row label="Compressions" value={String(planning.compressionCount)} />
        <Row label="Deferred" value={`${deferrals.totalDeferrals} tasks (${formatMinutes(planning.deferredEstimatedMinutes)})`} />
      </Section>

      <Section title="Execution">
        <Row label="Sessions" value={`${execution.sessionsStarted} started · ${execution.sessionsFinished} finished`} />
        <Row label="Median session" value={execution.medianSessionMinutes === null ? null : formatMinutes(execution.medianSessionMinutes)} muted={execution.medianSessionMinutes === null} />
        <Row label="Interruptions" value={String(execution.interruptions)} />
        <Row label="Finished rate" value={finishedRate} muted={finishedRate === null} />
        {execution.sessionsAbandoned !== null && execution.sessionsAbandoned > 0 && (
          <Row label="Sessions without a recorded end" value={String(execution.sessionsAbandoned)} muted />
        )}
      </Section>

      <Section title="Patterns">
        {facts.patterns.length === 0 ? (
          <div className="py-3 text-[11px] text-zinc-500">
            Not enough recorded behaviour yet to describe patterns for this week.
          </div>
        ) : (
          <ul className="flex flex-col gap-2 pt-1">
            {facts.patterns.map((p) => (
              <li key={p.id} className="flex items-start gap-2 text-xs text-zinc-300">
                <span className="text-zinc-100 leading-5">•</span>
                <span className="leading-5">
                  {p.statement}{" "}
                  <span className="font-mono text-[10px] text-zinc-500">
                    ({p.evidenceCount} {p.evidenceCount === 1 ? "observation" : "observations"})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
};

function estimateEstimateLabel(
  estimates: WeeklyBehaviorFacts["estimates"],
  formatted: string | null
): string | null {
  if (estimates.bias === "insufficient-data" || formatted === null) {
    return estimates.taskCount === 0
      ? null
      : `not enough completed tasks (${estimates.taskCount})`;
  }
  return formatted;
}
