# Trajectory — Engineering Roadmap

This roadmap breaks down the 20 milestones into concrete execution phases. Every phase builds upon verified, tested layers.

---

## Phase 1: Core Foundation & MVP Execution Engine (Milestones 01 – 13)

### Milestone 01: Project Bootstrap
- [x] Create directory layout and `.gitignore`.
- [x] Write architectural, product, data model, and roadmap documentation.
- [x] Initialize Git repository with initial baseline checkpoint.
- [x] Bootstrap Vite + React + TypeScript + Tailwind CSS project with `pnpm`.
- [x] Configure Vitest, React Testing Library, and TypeScript compilation.
- [x] Bootstrap Tauri 2 desktop shell configuration (`src-tauri`).

### Milestone 02: Design System & Visual Foundation
- [x] Establish design tokens: typography, high-contrast dark theme (calm, technical, understated), spacing, micro-animations.
- [x] Build core UI components: `Button`, `Modal`, `Badge`, `Slider`, `ProgressBar` (Input and Tooltip deferred — forms are hand-styled today).
- [x] Build layout frame: App Shell, Sidebar / Mode Switcher, Command Palette (Ctrl+K).

### Milestone 03: SQLite & Migrations Engine
- [x] Create migration runner and initial schema (`001_initial_schema`).
- [x] Implement database adapter supporting both native Tauri SQL plugin and in-memory test runner (sql.js).
- [x] Verify migrations and constraints with automated tests (fresh-install, idempotent re-run, default seeds).

### Milestone 04: Domain Models & Repositories
- [x] Define Zod schemas and TypeScript types for all entities: Areas, Goals, Projects, Tasks, Actions, Habits, WorkSessions, DailyStates, DailyReviews, RabbitHoles, BrainDumps. (Runtime validation at repository boundaries still pending.)
- [x] Implement typed repository classes with parameterized queries and soft-delete support.
- [x] Write repository integration tests (78 tests against real in-memory SQLite).

### Milestone 05: Application State Layer
- [x] Create Zustand stores: `useTaskStore`, `useHabitStore`, `useSessionStore`, `useStateStore`, `useReviewStore`, `useUIStore`.
- [x] Ensure state updates trigger appropriate persistence calls.
- [x] Verify state updates and store subscribers via unit tests.

### Milestone 06: Desktop Shell Integration
- [x] Verify native Tauri 2 windowing, clean title bar, and local persistence (verified end-to-end: data survives app restart; database at `%APPDATA%\com.trajectory.app\trajectory.db`).
- [x] Configure capability permissions for SQLite and notifications (least privilege; no filesystem access).

### Milestone 07: Today Screen (Primary Surface)
- [x] Primary Objective display and quick configuration.
- [x] "Now" active task cockpit with cognitive demand and duration badge.
- [x] "Must-Do" / "Should-Do" / "Optional" segmented task lists.
- [x] Daily State quick-slider widget (Energy, Clarity, Stress, Social).
- [x] Habit daily completion summary.
- [x] Workload capacity meter (Estimated minutes vs. available time).
- [x] Algorithmic Day Compression / Survival Mode trigger.

### Milestone 08: Tasks & Projects Management
- [ ] Complete hierarchy navigation: Life Area → Goal → Project → Task → Action. *(Areas/Goals/Projects are full CRUD since the hierarchy pass — goals repo+UI added; Actions remain schema-only)*
- [ ] Inline editing for title, estimated duration, importance, and cognitive demand.
- [x] Task status transitions (Inbox → Planned → In Progress → Completed / Deferred). *(inbox has no view yet — known gap)*

### Milestone 09: Habits & Minimum Viable Day
- [x] Dual-target habit tracker (Normal vs. Minimum Viable Target).
- [x] Continuous value logger (numeric steppers, partial completions).
- [x] Historical consistency view (7-day rolling, computed from real logs; no destructive streak resets).

### Milestone 10: Deep Work Mode
- [x] Distraction-free full-focus cockpit for single active task.
- [x] High-accuracy timer with pause/resume and elapsed tracker.
- [x] Non-disruptive interruption counter with quick note capture.
- [x] Work session persistence to `work_sessions` (crash-safe: row written at start, promoted on finish).

### Milestone 11: Rabbit Hole Capture
- [x] Global overlay (`R` hotkey) for instant tangent capture.
- [x] Automatic provenance link to active task and project.
- [ ] Rabbit hole backlog management with one-click conversion to Task/Project/Idea. *(repo + conversion statuses exist; no list/conversion UI)*

### Milestone 12: Brain Dump Scratchpad
- [x] Full-screen frictionless scratchpad for raw thought offloading.
- [ ] Autosave and historical version retention. *(manual save; single-slot document)*
- [x] Extraction tools to promote text blocks into actionable tasks (selection → task).

### Milestone 13: Daily Review (90-Second Shutdown)
- [x] Evening reflection wizard:
  1. Review completed vs. deferred work.
  2. Record energy drains and boosters.
  3. Set tomorrow's primary objective. *(persists to the review; surfacing it the next morning is pending)*
  4. Final state check.
- [x] Persist to `daily_reviews`.

---

## Phase 1.5: Make the Skeleton Real (interstitial hardening phase)

Goal: turn the MVP into a **real, persistent, trustworthy, usable** native application before adding features.

- [x] Native environment verified: `pnpm tauri dev` builds and launches the desktop window (generated icon set fixed the initial Windows build blocker).
- [x] Native persistence verified end-to-end: launch → create data → close → relaunch → data survives; production SQLite path documented (`%APPDATA%\com.trajectory.app\trajectory.db`, WAL mode, checkpointed on close).
- [x] Migration verification: fresh-install initialization, idempotent re-run, `_migrations` bookkeeping (single migration; no manufactured history).
- [x] Disposable-database trap removed: native DB failure is a hard boot error, never a silent in-memory fallback.
- [x] Crash-safe deep work sessions (row at start, finish/cancel transitions) with an injectable clock for tests.
- [x] Critical-path tests strengthened: 16 → 78 tests covering compression edge matrix, session lifecycle, habit consistency/history, rabbit holes, brain dump, repository CRUD, Today screen behavior, migration idempotency.
- [x] Realistic deterministic development seed data with dev-only invocation and refuse-when-nonempty guard.
- [x] Product exercised manually in the native app (morning / deep work / capture / overload / compression); confirmed friction fixed (accrued session minutes now reflect immediately).
- [x] Documentation updated to match reality (architecture boundary, data model semantics, roadmap status).
- [x] Production build (`pnpm tauri build`, NSIS) verified or blocker documented.

---

## NOW Stage: The Execution Console (interstitial phase)

Goal: when the app opens it answers *"What the hell should I be doing right now?"* — reliably and without guilt. Execution layer on top of the existing planning system; no redesign.

- [x] Planning state persisted (migration 003 `planning_state`, one row per local day, owned by `useTaskStore`).
- [x] Tomorrow continuity: yesterday's review objective becomes today's primary objective at load (logged, idempotent, never overwrites).
- [x] Now console: recovery banner → objective (editable, empty state "What matters today?") → quick capture → NOW cockpit (Start/Pause/Resume/Complete/Defer/Edit + Focus) → NEXT card → plan horizon → workload/state/habits.
- [x] Inline execution: sessions run on the Today screen; completing/deferring the active task settles the running session first.
- [x] Recovery: interrupted sessions surfaced with Resume (in-place adoption, no duplicates), Keep Record, Discard.
- [x] Explicit metrics module (`domain/metrics.ts`); planned-vs-logged vs estimate-vs-actual never conflated.
- [x] Quick capture → Inbox (capture first, classify later); rabbit-hole capture unchanged (`R`).
- [x] Midnight rollover: today-keyed stores reload when the local day changes under an open app.
- [x] Instrumentation: planning.*, quick-capture, and `session.resumed_after_interrupt` events via the existing event log.
- [x] ProjectsView migrated off raw-SQL-in-component; new `projectRepository`.

### NOW-stage decisions
1. Planning state persists in `planning_state` (per local day) owned by the existing task store — no second planning concept.
2. The review→morning handoff happens at the new day's first planning-state load; no background job.
3. **`D` remains Brain Dump** (established product shortcut); task deferral is a cockpit button + "Defer Current Task" command-palette action.
4. Starting execution no longer forces navigation — the cockpit runs the session inline; Deep Work stays available for focus mode.
5. Compression remains manual and explainable; Now only surfaces pressure (workload %, remaining-vs-available).

---

## Phase 2A.5: Semantic Stability (interstitial hardening phase)

Goal: make the domain substrate consistent, explicit, persistent, and trustworthy so Phase 2B behavioural synthesis builds on solid semantics. The contract itself lives in [SEMANTICS.md](SEMANTICS.md).

- [x] Session-settlement invariant: every transition out of active work settles the live session (`settleActiveSessionForTask`); previously only cockpit/palette paths did — a Planner drag could strand a session on a completed task.
- [x] Race elimination: finish/cancel/adopt null or claim state synchronously before awaits (rapid double-invoke once double-counted actual_minutes).
- [x] Persisted rows authoritative: session duration syncs to the row at a >=30s cadence; resume adopts recorded duration; crash loses <=30s.
- [x] Duplicate-event guards: pause/resume log only real transitions; recovery actions membership-guarded.
- [x] Local-day unification: `getRecentStatuses` uses `addDays`; `getTodayTotalDuration` deleted (dead + UTC/LIKE-wrong); date-sensitive tests use `todayLocal()`.
- [x] Validation at every DB->UI boundary: new `PlanningStateSchema`; DailyState/DailyReview/RabbitHole/BrainDump schemas wired (previously trusted casts).
- [x] Migration 004: `daily_states` duplicates repaired (latest kept) + UNIQUE(date) enforced — surfaced by native verification when the index refused pre-existing StrictMode-race duplicates; per-day upserts made atomic.
- [x] Objective clearing persists null; daily-state baseline contradiction unified (6/6/4/5).
- [x] Dead code removed: `getInboxTasks`, actions CRUD, 3 dead CSS classes, unused deps (recharts/clsx/tailwind-merge).
- [x] `docs/SEMANTICS.md` semantic contract; agent-infra repaired (release.md lint, build-feature formatter, truncated database/ui-design skills).
- [x] 137/137 tests; native verification: migrations v1→v4 on the real DB, duplicates repaired, integrity_check ok, recovery Discard exercised natively.

---

## Phase 2A: Operational Completeness (interstitial hardening phase)

Goal: make Trajectory operationally complete, reliable, and pleasant to use. No AI, no new abstractions — extend the existing architecture.

- [x] Temporal correctness: single shared local-date utility (`src/domain/time/date.ts`); all daily surfaces follow the user's LOCAL calendar day; timestamps remain UTC.
- [x] Crash recovery: interrupted sessions discovered at boot are surfaced on Today with Keep Record (finalizes `interrupted`) or Discard.
- [x] Task continuity: Kanban Inbox column plus Deferred recovery — deferred work is draggable back into the plan.
- [x] Kanban planner: five-column board (Inbox / Planned / In Progress / Completed / Deferred) over the existing `Task.status` with HTML5 drag-and-drop, task creation and full task editing; Kanban and Today share one state system.
- [x] Rabbit holes: capture backlog in the Daily Review — list, provenance, convert-to-Inbox-task, dismiss (archive). Original captures are preserved.
- [x] Reviews: today's saved review prefills the shutdown form (upsert on re-save); Recent Reflections card lists prior evenings.
- [x] Session robustness: truthful wall-clock timing (accumulated seconds + running-since marker); the refresh interval lives in the store, so sessions survive view lifecycle; throttled timers cannot distort recorded durations.
- [x] Semantic consistency: planned load vs logged work distinguished in labels; three-metric semantics documented; compression algorithm unchanged (spec'd).
- [x] Runtime validation: Zod parses at task/session/habit repository boundaries; corrupt rows fail loudly.
- [x] Behavioural instrumentation: migration 002 `event_log` records task/session/habit/review/rabbit-hole lifecycle events (append-only, fire-and-forget).
- [x] Regression tests for every touched behavior (105 tests, up from 78); no tests weakened or deleted.
- [x] Boot-race fix discovered during final native verification: React StrictMode double-booting hit `UNIQUE(_migrations.version)` — initialization is now a shared singleton promise with idempotent version inserts (`cd2e4f6`).
- [x] UI fixes: `animate-fadeIn` and `zinc-750/850` actually defined; command palette keyboard navigation (↑↓ + Enter); empty states for board columns and backlog.

### Phase 2A documented decisions
1. Kanban adds a Deferred column (beyond the four listed in the original brief) because this phase also requires deferred-task recovery — it reuses the existing status enum.
2. Dragging an unscheduled task into Planned schedules it for today (otherwise it would be invisible on Today).
3. Rabbit-hole conversion creates an Inbox task — captured curiosity becomes work to route, not an instant today commitment.
4. Interrupted-session finalization sets `end_time` to the recovery moment and leaves `duration_seconds` 0 — true worked time is unknown and never invented.

---

## Phase 2B: Behavioural Synthesis (completed 2026-09-06)

Goal: the first behavioural synthesis layer — a **descriptive** truth layer that can accurately answer "what actually happened?" without advising, predicting, or moralizing. "Learn before you predict." Contract in [SEMANTICS.md §9](SEMANTICS.md).

- [x] Truth-gap fixes: `session.cancelled` logs **before** row deletion with `duration_seconds` (abandonment is analysable); new `task.completed` / `task.deferred` / `compression.applied` events with estimate/date context.
- [x] Event-log read model: `getByDateRange` (indexed, optional type filter), `getByType`, `getLatestSnapshotsForRange`; typed payload schemas (`src/domain/events/payloads.ts`) parsed defensively — malformed events become coverage warnings, never crashes.
- [x] Historical plan reconstruction: `planning.day_snapshot` events (day_opened / compression_applied / material_replan) with signature-based dedupe; writes serialized through a queue so the StrictMode double-boot cannot race check-then-write (found and fixed via native verification).
- [x] Behaviour domain (`src/domain/behavior/*`): stats, estimates (median-based, threshold-suppressed), planning, sessions (abandonment via event log), deferrals, habit resilience (recovery-after-miss, not streaks), rabbit holes (real statuses), state associations (median-split, day-level, associational wording only), deterministic patterns with explicit threshold constants (`PATTERN_THRESHOLDS`).
- [x] `WeeklyBehaviorFacts` contract + `src/services/behaviorService.ts`: week-bounded gathering, per-block provenance (source/observations/excluded), coverage warnings (missing snapshots, mid-week history, in-progress week, malformed events).
- [x] Weekly Review UI: tab inside ReviewView (Daily Shutdown / Weekly Review), 4 sections (This Week / Planning / Execution / Patterns), no charts, week navigation defaulting to the last completed week, honest sparse/empty states, "week in progress" labelling, `Open Weekly Review` palette command.
- [x] 167/167 tests (aggregation, edge cases, thresholds, UI states, concurrent-boot regression).
- [x] Native verification (CDP-assisted, background-safe): migrations v1→v4 + integrity ok; live `planning.day_snapshot` writes with dedupe (0 duplicate rows on reload); Weekly Review renders and navigates in the running app; `buildWeeklyBehaviorFacts` returns real facts on live data.
- Deliberately out (Phase 3): LLM interpretation, prediction, adaptive planning, ranking, recommendations, notifications, dense dashboards.

### Phase 2B documented decisions
- **Snapshots live in the event log**, not a new table (spec-preferred; days without snapshots are excluded from planned-vs-actual claims and reported as a coverage warning, never faked).
- **`session.interrupted` is not a separate event** — `interruption_count` on `session.finished` + the `interrupted` row state already carry it.
- **`supported` confidence is reserved** for longitudinal evidence beyond a single week; within one week associations are at most `tentative`.
- **Habit metric is resilience, not streaks**: normal/minimum/missed days + median recovery-after-miss.
- **Boot ordering**: `loadPlanningState` before `loadTodayTasks` so the day snapshot records the objective in one write (avoided a churn pair per boot).

---

## Interstitial passes: UI Polish & Planner Fixes (completed 2026-09-07)

**UI polish pass (visual only, 8 commits):** NOW cockpit action row unified to ghost `action`-size buttons with icon-label gaps single-sourced in Button.tsx; cockpit titles `break-words` (leading characters never clip); objective banner shows the real local date (`<Weekday> · <YYYY-MM-DD>`) + honest empty-state placeholder; planning meta card stacks below 2xl (row form overflowed at 1280–1536); right-column cards unified to p-4/gap-3; Weekly Review header rhythm tightened, week-nav chevrons 32px with `disabled:opacity-40`; sidebar gap audit. Root-cause fix: single-letter hotkeys (n/r/d) fired mid-typing — "Finish…" opened New Task on the "n" and its autofocused input swallowed the rest of the sentence (the "ish the NOW execution console" data artifact); typing-burst guard + 4 regression tests. `DESIGN.md` added as the design-system contract for UI-generating/critiquing agents.

**Planner fixes (6 commits):** HTML5 DnD drops land — column roots `preventDefault` + `dropEffect="move"`, canonical `text/plain` transport, `dragDropEnabled: false` in tauri.conf (WebView2 hijacked native drags); verified by dragging a probe card through all five columns in the running app. Task delete wired to `softDeleteTask`: two-step "Delete?" confirm (3s revert), `task.deleted` event, refused while the task owns a live session; WAL-persisted `deleted_at` survives relaunch. 178/178 tests (21 suites).

---

## Interstitial pass: Phase 2C — Shipped Work vs Planning Activity (2026-09-14)

Descriptive execution balance + unlinked-goal blind-spot detection. Still no advice, prediction, LLM, or push.

- [x] Activity classification: exhaustive `Record<EventName, Class>` (compile-enforced); payload-dependent cases (status_changed from/to, habit target_met_status); dual-log dedupe (completed/deferred status_changed events are neutral); fail-fast on unknown types in dev. Classification is read-time derived — no stored column, no backfill.
- [x] Execution balance: `ratio = execution / (execution + planning)` per local day and week; explicit suppression constants (day 4, week 10); text readout only ("shipped work", never "productivity score", never coloured).
- [x] Migration 005: `goals.parked_until` (status column already existed with 'paused' in its CHECK — no status migration). Runner now converges if a crash lands between an ALTER and its version record (duplicate-column treated as applied).
- [x] Unlinked goals: 6-rule today-anchored read-time detection (grace 7d, window 7d, long-term 14d); section renders only when non-empty; three pull-based actions — Add a card this week (task-editor prefill via `useUIStore.taskDraft`, consumed on open/close/submit), Park this goal (two-step, status='paused' + parked_until + `goal.parked`), It's still live (`goal.acknowledged`, 7-day exclusion). `goal.card_added` is written only after the task row exists (atomicity).
- [x] Decision log: v3's `goal_orphaned_detected` push event + Sage surfacing cap deferred to the Sage phase; orphan detection is today-anchored, independent of the viewed week; hierarchy-CRUD reconciliation (commit zero) confirmed Branch A — the graph was the stale side.
- [x] 229/229 tests (28 suites): classification exhaustiveness + dual-log dedupe, balance suppression, orphan rule matrix, UI literal/persistence coverage, migration upgrade/idempotency, taskDraft stale-draft regression.

---

## Phase 2: Weekly Syntheses & Desktop Native Integration (Milestones 14 – 18)

### Milestone 14: Weekly Review — DELIVERED by Phase 2B (see above); per-project/demand breakdowns deferred

### Milestone 15: Basic Behavioral Analytics — descriptive core DELIVERED by Phase 2B as text-based facts (deliberately no Recharts dashboards; correlation ≠ causation enforced in wording)

### Milestone 16: Native Notifications
- [ ] Sparse, actionable notifications (session complete, shutdown reminder).
- [ ] Zero nagging / zero guilt messages.

### Milestone 17: System Tray Integration
- [ ] System tray icon showing active session status.
- [ ] Tray menu with quick capture and resume controls.

### Milestone 18: Keyboard Shortcuts & Command Palette
- [ ] Global shortcut engine (`N`, `D`, `R`, `Space`, `Ctrl+K`).
- [ ] Keyboard navigation across lists with arrow keys and `Enter`.

---

## Phase 3: Packaging, Hardening & Delivery (Milestones 19 – 20)

### Milestone 19: Desktop Packaging
- [ ] Tauri 2 bundle configuration for Windows (`.msi` / `.exe`).
- [ ] Asset optimization and startup time verification (<500ms).

### Milestone 20: Comprehensive Polish & End-to-End Testing
- [ ] Playwright E2E verification of primary user flows:
  - First-time onboarding & task scheduling.
  - Full Deep Work execution & work session logging.
  - Overloaded day compression.
  - Rabbit hole capture during deep work.
  - Daily review shutdown.
- [ ] Final performance and offline durability audit.
