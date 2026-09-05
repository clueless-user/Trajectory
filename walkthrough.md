# Trajectory — Status Walkthrough (updated 2026-09-05)

**Current state: Phases 1, 1.5, 2A, and the UI-consistency pass are complete.** — typecheck ✅ · **105/105 tests** (13 suites) ✅ · `pnpm build` ✅ · `pnpm tauri dev` + fullscreen verified ✅ · native persistence + migration v2 verified ✅ · NSIS installer built ✅ · docs + knowledge graph synced ✅ · clean git checkpoint ✅ · **no git remote configured (push pending a URL)**

Trajectory is a local-first personal execution OS (see [README.md](README.md)). This file is the session-level status record; the deep docs live in `docs/` and `.agents/KNOWLEDGE_GRAPH.md`.

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

### UI-consistency pass (`4906dc5` → `fbbf3f5`)
- Button sizing single-sourced (the `.btn-*` classes had silently-conflicting duplicates); icon wrappers flex-centered — no more baseline-sunk icons, worst on large buttons; label nowrap; icon sizes normalized per button size; Modal X + Planner pencil given proper hit targets.
- Adaptive fullscreen: Planner columns flex to fill the window; `2xl:` caps raised across views (Today/Habits/Projects 7xl, BrainDump 6xl, DeepWork 5xl, Review 4xl); Habits gains a 3-column grid. Verified visually in the maximized native app.
- Knowledge graph: 8 gotchas marked FIXED, 5 new recorded (G-36…G-40).

---

## How to run

```bash
pnpm tauri dev      # native desktop app (cold compile ~15 min, then incremental)
pnpm tauri build    # NSIS installer + release exe
pnpm test           # 105 tests, real in-memory SQLite
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
