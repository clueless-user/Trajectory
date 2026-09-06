# Trajectory — Status Walkthrough (updated 2026-09-06)

**Current state: Phases 1, 1.5, 2A, the UI pass, NOW, 2A.5 (semantic stability), and Phase 2B (behavioural synthesis) are complete.** — typecheck ✅ · **167/167 tests** (18 suites) ✅ · `pnpm build` ✅ · native persistence + migrations v1→v4 verified ✅ · the full NOW loop verified natively ✅ · daily-state duplicates repaired + uniqueness enforced on the real DB ✅ · domain semantic contract documented (`docs/SEMANTICS.md`) ✅ · clean git checkpoint ✅ · **no git remote configured (push pending a URL)**

Trajectory is a local-first personal execution OS (see [README.md](README.md)). This file is the session-level status record; the deep docs live in `docs/` and `.agents/KNOWLEDGE_GRAPH.md`.

---

## Phase 2B — Behavioural Synthesis (2026-09-06, complete)

**What was built:** the first descriptive truth layer. The event log became a typed, bounded read model (`getByDateRange`/`getByType`/snapshot range queries; payloads parsed defensively — malformed history becomes a warning, never a crash). Truth gaps closed: `session.cancelled` now logs before its row is deleted and carries `duration_seconds`; dedicated `task.completed` / `task.deferred` / `compression.applied` events give analytics the estimate/date context the generic transitions lacked. Historical plans are reconstructable via `planning.day_snapshot` events (day_opened / compression_applied / material_replan), content-deduped and written through a serialized queue.

The pure aggregation domain (`src/domain/behavior/*`) + `behaviorService` assemble a traceable `WeeklyBehaviorFacts` object: execution, planning, estimate accuracy (median-based, threshold-suppressed), deferrals, habit resilience, rabbit holes, day-level state associations, and deterministic patterns with explicit `PATTERN_THRESHOLDS`. Every number carries provenance; sparse data surfaces as coverage warnings instead of fake completeness.

**The deliverable:** a Weekly Review tab inside the Review view — four calm text sections (This Week / Planning / Execution / Patterns), week navigation defaulting to the last completed week, honest empty states, "week in progress" labelling, and an `Open Weekly Review` command-palette command. Descriptive only: no advice, no scores, no causal language, no LLM.

**Verified:** 167/167 tests (18 suites); native run confirmed migrations + integrity, live snapshot writes with dedupe (a reload adds 0 rows — a StrictMode double-boot race was caught here and fixed in `eb0d26d`), and the Weekly Review rendering/navigating in the running app (CDP-assisted, background-safe).


---

## Phase history

### Phase 1 — MVP (`8b5a609` → `1fed554`)
Full vertical stack: 6 views, 6 Zustand stores, 7 repositories, DatabaseAdapter (native Tauri SQL / in-memory sql.js), domain services (compression, habit consistency, session timing), 12 Zod-modeled entities, keyboard shortcuts, command palette.

### Phase 1.5 — Make the skeleton real (`871fc7c` → `98d9848`)
- Native build unblocked (icon set, NSIS bundle config); `pnpm tauri dev` and `pnpm tauri build` verified; `Trajectory_0.1.0_x64-setup.exe` produced.
- Native persistence verified end-to-end (launch → write → close → relaunch → survive); production DB at `%APPDATA%\com.trajectory.app\trajectory.db` (WAL mode, checkpointed on close).
- Disposable-database trap removed (native DB failure = hard boot error, never silent in-memory).
- Crash-safe sessions (row written at start), real habit-consistency history, deterministic dev seed (dev-only, refuses when tasks exist), test matrix 16 → 78, docs synced.

### Phase 2A — Operational completeness (`476d3ab` → `3bd7619`)
- **Temporal correctness**: shared `domain/time/date.ts`; "today" is the user's LOCAL calendar day everywhere (was 9 independent UTC computations).
- **Crash recovery**: interrupted sessions surface on Today at boot → Keep Record (finalizes `interrupted`) or Discard.
- **Session robustness**: wall-clock timing (`accumulatedSeconds` + `runningSinceMs`), store-owned refresh — view unmounts/throttling can't distort durations.
- **Kanban planner**: 5-column board over `Task.status` (Inbox/Planned/In Progress/Completed/Deferred), drag-and-drop, full task editing; Inbox visibility and Deferred recovery.
- **Rabbit holes**: capture backlog in Daily Review — convert-to-Inbox-task / dismiss(archive); original captures preserved.
- **Reviews**: today's review prefills the shutdown form (upsert); Recent Reflections list.
- **Runtime validation**: Zod at task/session/habit repository boundaries.
- **Instrumentation**: migration 002 `event_log` — append-only lifecycle events for every entity.
- **Boot-race fix** (`cd2e4f6`): StrictMode double-boot hit `UNIQUE(_migrations.version)` in native verification — singleton init promise + idempotent inserts.
- Decision log in ROADMAP Phase 2A (Deferred column, drag→Planned schedules today, conversion→Inbox, truthful recovery semantics).

### NOW stage — the execution console (`4a5fcbb` → `2be6d63`)
- **Planning state persisted** (migration 003 `planning_state`, one row per local day): primary objective and available minutes survive restarts; the review→morning objective handoff is real (logged, idempotent, never overwrites).
- **The Now console**: recovery banner ("Were you working on something?" with Resume/Keep Record/Discard) → objective (editable, "What matters today?" empty state) → quick capture (type → Inbox) → NOW cockpit with inline Start/Pause/Resume/Complete/Defer/Edit + Focus → NEXT card → plan horizon → workload/state/habits rail.
- **Session robustness**: completing/deferring the active task settles the running session first; recovery Resume adopts the paused row in place (no duplicates, `session.resumed_after_interrupt` logged).
- **Explicit metrics** (`domain/metrics.ts`): planned load, remaining load, logged work, remaining estimate — no more conflated "committed minutes".
- **Midnight rollover**: today-keyed stores reload when the local day changes under an open app.
- **Layering fix**: ProjectsView reads through `projectRepository`/`taskRepository` (no raw SQL in components).
- **Native verification**: the full loop — set objective → quick capture → start → pause → close → relaunch → recovery banner → Resume — executed against the real SQLite DB (migrations v1→v3), every step event-logged.
- Decision log in ROADMAP NOW stage (`D` stays Brain Dump; inline start; handoff at load; compression stays manual).

### Phase 2A.5 — Semantic stability (`868be7f` → `9b651a4`)
- Session-settlement invariant: every transition out of active work settles the live session (Planner drag previously stranded sessions on completed tasks).
- Race elimination + duplicate-event guards (finish double-invoke once double-counted actual_minutes).
- Persisted rows authoritative: duration syncs to the session row (>=30s cadence); Resume adopts recorded time; crash loses <=30s.
- Validation at every DB→UI boundary incl. new PlanningStateSchema; migration 004 repaired real daily_states duplicates (surfaced when the new unique index refused them) and enforced one row per date.
- Local-day unification; objective clearing; dead code removed; **`docs/SEMANTICS.md`** semantic contract; agent-infra repairs.

### UI-consistency pass (`4906dc5` → `fbbf3f5`)
- Button sizing single-sourced (the `.btn-*` classes had silently-conflicting duplicates); icon wrappers flex-centered — no more baseline-sunk icons, worst on large buttons; label nowrap; icon sizes normalized per button size; Modal X + Planner pencil given proper hit targets.
- Adaptive fullscreen: Planner columns flex to fill the window; `2xl:` caps raised across views (Today/Habits/Projects 7xl, BrainDump 6xl, DeepWork 5xl, Review 4xl); Habits gains a 3-column grid. Verified visually in the maximized native app.
- Knowledge graph: 8 gotchas marked FIXED, 5 new recorded (G-36…G-40).

---

## How to run

```bash
pnpm tauri dev      # native desktop app (cold compile ~15 min, then incremental)
pnpm tauri build    # NSIS installer + release exe
pnpm test           # 137 tests, real in-memory SQLite
pnpm typecheck && pnpm build
```

First launch seeds 4 areas + 4 dual-target habits. Dev builds can load the deterministic demo dataset via Command Palette (`Ctrl+K`) → *Load Development Seed Data (Dev)*.

## Known remaining gaps (deliberately deferred)

- Tomorrow-objective persists to the review but isn't surfaced on the next morning's Today banner; `primaryObjective`/`availableMinutes` remain memory-only.
- No in-session abandon button in Deep Work (cancel exists in the store; recovery Discard covers post-restart).
- Actions/subtasks and goals: schema + (partial) repo only, no UI.
- Zod validation covers task/session/habit boundaries; other repos still trusted casts.
- No lint/format tooling; `release.md` references a nonexistent `pnpm lint`.
- `database/SKILL.md` and `ui-design/SKILL.md` are truncated on disk.
- HTML5 drag-and-drop verified by store tests; the raw drag gesture needs one manual confirmation (synthetic input can't drive WebView DnD).
- No git remote — entire history is local on `main`.

## Git

```text
2be6d63 feat: complete NOW stage — native verification, UX fix, docs
8da27ae feat: midnight rollover, defer command, Now failure-case tests
c899e32 feat: the Now console — inline execution, NEXT, quick capture
f02b049 feat: explicit execution metrics domain module
4a5fcbb feat: persist planning state (migration 003) with tomorrow handoff
690d796 docs: walkthrough covers phase 2A + UI pass; KG snapshot current
fbbf3f5 docs: knowledge graph — UI consistency fixes (button sizing, responsive caps)
c6b6039 feat: adaptive fullscreen layout
4906dc5 fix: consistent icon alignment in buttons
dd4f98b docs: sync knowledge graph and roadmap with post-2A reality
c3ae3f7 docs: add project README
3bd7619 docs: phase 2A complete — verification ledger, doc sync, walkthrough
cd2e4f6 fix: make database boot safe under concurrent initialization
ff62d6c fix: define missing Tailwind shades/animations, palette keyboard nav
90da102 feat: Zod runtime validation at repository boundaries
16d7cf4 feat: rabbit-hole backlog and review retrieval in the shutdown view
3b5e6e5 feat: Kanban planner board with inbox and deferred recovery
192c21d feat: behavioural instrumentation via event_log (migration 002)
0ea099a feat: truthful session timing, store-owned timer, crash recovery
476d3ab fix: establish consistent local-date handling via shared date utility
… (Phase 1.5 / MVP history below)
```
