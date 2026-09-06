# Trajectory — Domain Semantic Contract

The authoritative answer to *"what does this field/event/metric actually mean?"*.
Every definition here is implemented and tested; the knowledge graph records the verification status. If code and this document disagree, one of them is a bug — fix it in the same commit.

---

## 1. Local day

**Definition:** the user's LOCAL calendar day (`YYYY-MM-DD`), computed exclusively by `src/domain/time/date.ts` (`todayLocal`, `addDays`, `dayFromTodayLocal`).

- Stored timestamps (created_at, start_time, completed_at, …) are always **UTC ISO-8601**.
- Day keys (`scheduled_date`, `daily_states.date`, `daily_reviews.date`, `planning_state.date`, `habit_logs.date`) are **local** calendar days.
- Date-only arithmetic uses `addDays` (UTC-anchored string math — timezone/DST-safe).
- `useDayRollover` reloads all today-keyed stores when the local day changes while the app is open (30 s check + window focus).
- **Invariant:** a user's local day must never silently become a UTC day. Known accepted exception: none.

## 2. Planning state

One row per local day in `planning_state` (UNIQUE date), owned by `useTaskStore`.

| Field | Meaning | Lifecycle |
| --- | --- | --- |
| `primary_objective` | The single thing that matters today. `null` = not yet chosen (Now asks "What matters today?"). | Set/edited via TodayView (persisted immediately, event `planning.objective_set`). **Clearing** (empty submit) persists `null` — a legitimate state. **Handoff:** on the first load of a new day with no row, yesterday's `daily_reviews.tomorrow_objective` seeds it (event `planning.objective_carried_over`; idempotent; never overwrites an existing row). |
| `available_minutes` | Capacity the user declares for the day (default 420 until a row exists). Currently no UI writer — code/test API only. | Event `planning.available_minutes_changed`. |

Transition audit (source → mutation → persistence → event → read → UI): UI edit → store setter → `planningStateRepository.saveForDate` upsert → `planning.*` event → `loadPlanningState`/reactive store read → TodayView banner / workload bar. There is no write path without a read path and vice versa.

## 3. Task status semantics

`Task.status` is the **single** task-state system. The Planner board is a projection of it, not a second one.

| Status | Meaning | Legal entries | Legal exits |
| --- | --- | --- | --- |
| `inbox` | Exists, not yet routed. Created by unchecked "Schedule for Today", quick capture, rabbit-hole conversion. | create, Planner drag | → planned (schedules today when unscheduled), → completed/deferred/cancelled |
| `planned` | Committed to a day (`scheduled_date` set). | create (checked), Planner drag, inbox routing | → in_progress, completed, deferred, cancelled |
| `in_progress` | Being executed. Auto-set when a session starts. | start, Planner drag | → completed, deferred, planned, cancelled |
| `completed` | Done. `completed_at` = when the *current* completion happened (cleared on reopen — history lives in the event log). | any active state | → planned/in_progress (reopen; `completed_at` cleared), deferred |
| `deferred` | Explicitly pushed out (compression or manual). Retains `scheduled_date` and all history; recoverable via Planner drag. | planned/in_progress | → planned (rescheduled), in_progress, cancelled |
| `cancelled` | Will not happen. Preserves history. | any | (terminal in current UI) |

**Session-settlement invariant:** any transition out of `in_progress` (and any completion/deferral from any state) settles the live session first via `settleActiveSessionForTask` — a completed/deferred task must never keep a session running. Compression cannot defer `in_progress` tasks by construction.

## 4. Work-session lifecycle

A session is one focused work engagement with one task, recorded in `work_sessions`.

- **Created at start** with `completed_state: 'paused'` — the crash tombstone. An orderly app exit mid-session leaves exactly this row.
- **Finished** (`'finished'`): promoted on finish; carries `end_time`, `duration_seconds`, interruption count, notes.
- **Interrupted** (`'interrupted'`): Keep Record on the recovery banner finalizes a tombstone; `end_time` = recovery moment, duration = last synced value.
- **Cancelled** (user cancel / Discard): the row is deleted — the session never happened.
- **Resumed after interruption**: adopts the same row in place (same id — never a duplicate), with the recorded `duration_seconds` as its starting accumulation.

**Authority rule:** the persisted row is the source of truth; the UI timer is a projection. Elapsed time derives from wall-clock timestamps (`accumulatedSeconds` + `runningSinceMs`); `syncElapsed` persists `duration_seconds` to the row at a ≥30 s cadence, so a crash loses at most 30 s of recorded truth. Duration = running time only (paused gaps excluded); `start_time`/`end_time` are wall-clock brackets and intentionally differ from `duration_seconds`. Rapid duplicate calls (double-finish, double-resume, double-adopt) are structurally impossible — live state is nulled/claimed synchronously before any await.

## 5. Workload metrics (`src/domain/metrics.ts`)

| Metric | Definition | Source fields | Statuses counted | Time basis | Scope | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| `plannedLoadMinutes` | Total planned work for the day | `estimated_minutes` | planned, in_progress | estimated | today's plan | planning |
| `remainingLoadMinutes` | How much of today's plan is left | `estimated_minutes − actual_minutes` | planned, in_progress | estimate minus actual | today's plan | planning/execution |
| `loggedWorkMinutes` | Work recorded as finished today | `actual_minutes ‖ estimated_minutes` | completed | actual-first | today's completions | review |
| `remainingEstimateMinutes` | How much of THIS task is left (never negative) | `estimated_minutes − actual_minutes` | any single task | estimate minus actual | task | execution |

Compression's internal `committedMinutes` (actual‖estimated of completed+in-progress) is part of the spec'd algorithm, not a shared metric. Views must not hand-roll aggregations — import from `metrics.ts`.

## 6. Event log (`event_log`, migration 002)

Append-only behavioural substrate. **Current state lives in the entity tables; the event log records historical behaviour** — never reconstruct current truth by replaying events, and never treat entity rows as history.

Naming convention: `<domain>.<past_tense_verb>` with compound details allowed (`session.resumed_after_interrupt`). Do not rename existing events (history compatibility); `rabbit_hole.<status>` is generated from the status value by design.

| Event | Producer | Payload | Meaning |
| --- | --- | --- | --- |
| `task.created` | useTaskStore.createTask | title, importance, status, source | A task was created (manual/rabbit-hole source) |
| `task.quick_capture_created` | createTask(source: quick_capture) | title | Quick capture → Inbox |
| `task.status_changed` | updateTaskStatus / moveTaskStatus / compressPlan | from, to, source? | Status transition (source: planner/today_defer/palette/compression) |
| `task.details_updated` | updateTaskDetails | title | Fields edited (status untouched) |
| `task.deleted` | useTaskStore.deleteTask (Planner card) | title | Soft delete (`deleted_at` set); refused while the task owns a live session |
| `session.started` | startSession | task_id | Execution began (crash-tombstone row written) |
| `session.paused` / `session.resumed` | pause/resume | — | Real transitions only (guarded against duplicates) |
| `session.finished` | finishSession | duration_seconds, completed_task, interruption_count | Work settled |
| `session.cancelled` | cancelSession | — | Row deleted — never happened |
| `session.recovered_interrupted` | keepInterruptedRecord | — | Tombstone finalized as `interrupted` |
| `session.discarded` | discardInterruptedSession | — | Tombstone deleted |
| `session.resumed_after_interrupt` | resumeInterruptedSession | task_id | Adopted in place |
| `habit.logged` | logHabitValue | date, value, target_met_status | Habit value upserted |
| `review.saved` | saveReview | date | Evening review upserted |
| `planning.objective_set` | setPrimaryObjective | date, objective | Objective set/cleared (entity_type: planning) |
| `planning.available_minutes_changed` | setAvailableMinutes | date, minutes | Capacity changed (entity_type: planning) |
| `planning.objective_carried_over` | loadPlanningState | date, source | Review→morning handoff applied |
| `rabbit_hole.captured` | rabbitHoleRepository | active_task_id | Tangent captured with provenance |
| `rabbit_hole.converted_task` / `rabbit_hole.archived` | updateStatus | converted_id | Backlog resolution (name derived from status) |

Deliberately **not** evented: daily-state slider changes (mutable current state — the row is the record), `recordInterruption` (captured in the session row and `session.finished` payload), UI navigation.

## 7. Current state vs history

- **Current truth:** entity tables (`tasks`, `planning_state`, `daily_states`, `work_sessions` active row, `habit_logs` per-day value, `daily_reviews` per-day). Query these for "what is true now".
- **Historical behaviour:** `event_log` (append-only) plus immutable row fields (`completed_at`, session rows). Query these for "what happened".
- Known accepted loss: `daily_states` mutates in place — intra-day slider history is not kept (day-level granularity is the record). Revisit only if 2B needs it.

## 8. Write-path inventory (nothing write-only)

| Entity | Created | Retrieved | Acted on | Resolved |
| --- | --- | --- | --- | --- |
| Tasks | ✓ | ✓ (Today/Planner/Projects) | ✓ | ✓ |
| Planning state | ✓ (set/handoff) | ✓ (boot/rollover) | ✓ (edit/clear) | ✓ |
| Work sessions | ✓ (start) | ✓ (recovery banner; 2B read APIs exist) | ✓ (finish/pause/defer) | ✓ |
| Rabbit holes | ✓ (`R`) | ✓ (Review backlog) | ✓ (convert/dismiss) | ✓ |
| Deferred tasks | ✓ (compression/defer) | ✓ (Planner Deferred column) | ✓ (drag back to Planned) | ✓ |
| Reviews | ✓ (ReviewView) | ✓ (prefill + Recent Reflections) | ✓ (re-save upserts) | ✓ |
| Habit logs | ✓ | ✓ (Today/Habits/consistency) | ✓ (overwrite per day) | n/a |
| Event log | ✓ | read APIs only (2B substrate — intentionally no UI) | n/a (append-only) | n/a |

## 9. Phase 2B — behavioural synthesis semantics

Phase 2B adds a **descriptive** behavioural layer on top of the event log and entity tables. It aggregates; it never advises. These rules are normative for everything under `src/domain/behavior/` and `src/services/behaviorService.ts`.

### 9.1 Event taxonomy additions

New events introduced in Phase 2B (all follow the `<domain>.<past_tense_verb>` convention; existing events are unchanged):

| Event | Producer | Payload | Meaning |
| --- | --- | --- | --- |
| `task.completed` | updateTaskStatus (→ completed) | estimated_minutes, scheduled_date | A task reached `completed`. Emitted **in addition to** `task.status_changed` (which stays generic). |
| `task.deferred` | updateTaskStatus/moveTaskStatus (→ deferred) | estimated_minutes, scheduled_date | A task reached `deferred`, same dual-logging rule. |
| `compression.applied` | compressPlan | date, deferred_count, deferred_minutes | The day plan was compressed. |
| `planning.day_snapshot` | useTaskStore snapshot writer (see 9.2) | date, available_minutes, primary_objective, total_planned_minutes, planned_tasks[], snapshot_reason | Point-in-time reconstruction record of the day's plan of record. entity_type `planning`. |

`session.cancelled` keeps no duration semantics change in the row (there is no row), but from Phase 2B it is logged **before** deletion and its payload carries `duration_seconds` (accumulated running time at cancel) so abandonment is analysable. This is the only payload added to an existing event; older cancelled events without the payload are simply counted as evidence of cancellation with unknown duration.

### 9.2 Plan snapshot semantics

Historical planned workload cannot be reconstructed from current task state alone (statuses mutate). The record of "what was planned on day D" is the **latest** `planning.day_snapshot` event for D.

- **When written:** (a) first material load of a day — the day has at least one planned task or a set objective (`snapshot_reason: "day_opened"`); (b) immediately after compression (`"compression_applied"`); (c) after a material replan of the day's task set (`"material_replan"`).
- **Dedupe:** the meaningful payload is hashed (date + available_minutes + objective + sorted {task_id, status, estimated_minutes} triples); a snapshot identical to the last one for that date is **not** written. No per-render snapshots, ever.
- **Reader:** `EventLogRepository.getLatestSnapshotsForRange(start, end)` returns the newest snapshot per local date in the range (bounded query, in-memory dedupe).
- **Confidence rule:** a day with no snapshot has **no trustworthy plan record**. Planned-vs-actual comparisons for that day are either excluded from strong claims or labelled low-confidence/reconstructed. Snapshots only exist from Phase 2B onward; weeks before that have planned data only where snapshots happen to exist. This is reported as a coverage warning, never faked.

### 9.3 Date attribution

Every behavioural fact is attributed to a **local calendar day** by one explicit rule:

| Subject | Attributed to |
| --- | --- |
| Completed task | local date of `completed_at` |
| Work session | local date of `start_time` |
| Planned workload | `scheduled_date` of the snapshot's task list |
| Daily state | `daily_states.date` |
| Habit log | `habit_logs.date` |
| Rabbit hole | local date of capture timestamp |
| Event generally | local date of `created_at` (UTC instant → local day via `src/domain/time/date.ts`) |

### 9.4 Week boundaries

- A week is a **local** week starting **Monday**, computed with `src/domain/time/date.ts` utilities — never UTC arithmetic, never `toISOString().split("T")[0]`.
- The Weekly Review defaults to the **last completed week** (the most recent Monday-started week whose Sunday has fully passed in local time).
- The current, incomplete week may be viewed but is always labelled "week in progress" and its weekly aggregates are presented as partial. Incomplete weeks are never silently mixed into completed-week claims.

### 9.5 Missing-data policy

Sparse data is stated, never papered over:

- Missing estimate → task excluded from estimate-accuracy facts (counted in provenance `excludedCount`).
- Missing/zero actual minutes → excluded from estimate-error aggregates; zero-duration sessions are counted as sessions but excluded from median-duration.
- State not logged on a day → that day contributes to no state-association pair.
- Habit newer than the review window → adherence computed only over the days it existed.
- Task created mid-week → planned-workload counts it only for days where a snapshot included it.
- Event history begins mid-week → `coverage.earliestReliableDate` is set and facts before it are marked reconstructed or omitted.
- Malformed event payloads → parsed defensively (`parseEventPayload` never throws); the event is skipped and the skip is counted in `coverage.warnings`.

### 9.6 Descriptive / predictive boundary

The behaviour layer **may** output: historical summaries, deterministic patterns, associations with evidence counts and confidence levels (`insufficient | tentative | supported`), coverage warnings.

It must **never** output: completion probability, future workload prediction, adaptive scheduling, automatic task ranking, personalized recommendations, LLM interpretation, productivity or worth scores, or causal claims ("caused", "because") — only associational language ("was associated with", "occurred alongside"). Every visible pattern carries its evidence count; claims below documented thresholds are suppressed, not softened.
