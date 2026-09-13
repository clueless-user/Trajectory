import React, { useCallback, useEffect, useState } from "react";
import { buildWeeklyBehaviorFacts } from "../services/behaviorService";
import { WeeklyBehaviorFacts } from "../domain/behavior/types";
import { addDays, todayLocal, weekStart as weekStartOf } from "../domain/time/date";
import { formatMinutes } from "../domain/metrics";
import { CalendarRange, ChevronLeft, ChevronRight, Loader2, Link2, PauseCircle, Heart } from "lucide-react";
import { useHierarchyStore } from "../stores/useHierarchyStore";
import { useUIStore } from "../stores/useUIStore";
import { ORPHAN_LONG_TERM_DAYS } from "../domain/behavior/orphanedGoals";

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
    // -mt-2 (V-8): the tab toggle above contributes a 24px parent gap; pull
    // the week header up so the toggle→header rhythm matches the compact
    // header spacing used across views.
    <div className="flex flex-col gap-5 -mt-2">
      {/* Week selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 font-semibold uppercase tracking-wider">
          <CalendarRange className="w-4 h-4" />
          <span>
            Week of {weekStart}
            {isCurrentWeek && <span className="text-amber-400"> · week in progress</span>}
          </span>
        </div>
        {/* V-9: 32px hit areas, hover feedback, dimmed at range bounds. */}
        <div className="flex items-center gap-1">
          <button
            aria-label="Previous week"
            className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-40"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            aria-label="Next week"
            className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-40"
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
  // Unlinked goals are a today-anchored blind-spot view — a week with orphans
  // is not "no recorded activity" (the section renders even on empty weeks).
  const empty =
    execution.sessionsStarted === 0 &&
    execution.tasksCompleted === 0 &&
    deferrals.totalDeferrals === 0 &&
    facts.orphanedGoals.length === 0;

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
        {/* Phase 2C: execution balance — text readout only, never a bar or score */}
        {facts.executionBalance.readout && (
          <div className="pt-2 text-xs text-zinc-300">{facts.executionBalance.readout}</div>
        )}
        {facts.executionBalance.suppressedReason && (
          <div className="pt-2 text-[11px] text-zinc-500">{facts.executionBalance.suppressedReason}</div>
        )}
        {facts.executionBalance.perDay
          .filter((d) => d.ratio !== null)
          .map((d) => (
            <div key={d.date} className="flex items-center justify-between py-1">
              <span className="text-[11px] text-zinc-500">
                {new Date(`${d.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" })} · {d.date}
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                {d.execution} shipped / {d.planning} planning
              </span>
            </div>
          ))}
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

      <UnlinkedGoalsSection goals={facts.orphanedGoals} />
    </div>
  );
};

// ---------------- Unlinked goals (Phase 2C, pull-based) ----------------
// Rendered only when non-empty; a read-time view — opening it writes nothing.
const UnlinkedGoalsSection: React.FC<{
  goals: WeeklyBehaviorFacts["orphanedGoals"];
}> = ({ goals }) => {
  const { parkGoal, acknowledgeGoal, projects, loadHierarchy } = useHierarchyStore();
  const { setNewTaskModalOpen, setTaskDraft } = useUIStore();
  // The project picker needs the hierarchy loaded even if the Projects view
  // was never opened — otherwise linkable goals would show the no-projects hint.
  useEffect(() => {
    loadHierarchy();
  }, [loadHierarchy]);
  // Per-row local UI state: which goal is in the park-confirm step, and which
  // just got acknowledged (confirmation copy).
  const [parkingId, setParkingId] = useState<string | null>(null);
  const [parkDate, setParkDate] = useState(todayLocal());
  const [notedId, setNotedId] = useState<string | null>(null);

  if (goals.length === 0) return null;

  const handleCardViaEditor = (goalId: string) => {
    const firstProject = projects.find((p) => p.goal_id === goalId);
    setTaskDraft({ project_id: firstProject?.id, scheduledToday: true });
    setNewTaskModalOpen(true);
  };

  const handlePark = async (goalId: string) => {
    await parkGoal(goalId, parkDate);
    setParkingId(null);
  };

  return (
    <Section title="Unlinked goals">
      <div className="pb-2 text-[11px] text-zinc-500">
        <div>Active goals without linked work as of today.</div>
        <div>Active goals without linked work in the last 7 days. Parking is a valid outcome.</div>
      </div>
      <div className="flex flex-col gap-3 pt-1">
        {goals.map((g) => {
          const linkedProjects = projects.filter((p) => p.goal_id === g.goalId);
          const noted = notedId === g.goalId;
          return (
            <div key={g.goalId} className="p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/80 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-200 truncate">{g.title}</div>
                  <div className="text-[11px] font-mono text-zinc-500">
                    {g.areaTitle ? `${g.areaTitle} · ` : ""}
                    {g.daysSinceLastLinkedWork === null
                      ? "no linked work yet"
                      : `${g.daysSinceLastLinkedWork} days since last linked work`}
                    {" · "}
                    {g.projectCount} project{g.projectCount === 1 ? "" : "s"}
                  </div>
                  {g.daysSinceLastLinkedWork !== null && g.daysSinceLastLinkedWork >= ORPHAN_LONG_TERM_DAYS && (
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Unlinked for {ORPHAN_LONG_TERM_DAYS}+ days — a parked candidate.
                    </div>
                  )}
                </div>
              </div>

              {noted ? (
                <div className="text-[11px] text-zinc-400">Noted — still live.</div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {linkedProjects.length > 0 ? (
                    <button
                      onClick={() => handleCardViaEditor(g.goalId)}
                      className="text-[11px] text-zinc-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Add a card this week</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-zinc-600">No projects linked to this goal.</span>
                  )}

                  {parkingId === g.goalId ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={parkDate}
                        onChange={(e) => setParkDate(e.target.value)}
                        className="bg-zinc-950 border border-amber-500/50 rounded px-2 py-0.5 text-[11px] font-mono text-zinc-200 focus:outline-none w-28"
                      />
                      <button
                        onClick={() => handlePark(g.goalId)}
                        className="text-[11px] text-amber-300 hover:text-amber-200"
                      >
                        Park
                      </button>
                      <button
                        onClick={() => setParkingId(null)}
                        className="text-[11px] text-zinc-500 hover:text-zinc-300"
                      >
                        Keep active
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setParkDate(todayLocal());
                        setParkingId(g.goalId);
                      }}
                      className="text-[11px] text-zinc-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                    >
                      <PauseCircle className="w-3.5 h-3.5" />
                      <span>Park this goal</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      acknowledgeGoal(g.goalId);
                      setNotedId(g.goalId);
                    }}
                    className="text-[11px] text-zinc-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                  >
                    <Heart className="w-3.5 h-3.5" />
                    <span>It's still live</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
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
