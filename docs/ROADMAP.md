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
- [ ] Complete hierarchy navigation: Life Area → Goal → Project → Task → Action. *(read-only Hierarchy view exists; goals have no repo/UI, actions none)*
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

## Phase 2: Weekly Syntheses & Desktop Native Integration (Milestones 14 – 18)

### Milestone 14: Weekly Review
- [ ] Planned vs. actual execution analytics.
- [ ] Estimation accuracy breakdown by project and cognitive demand.
- [ ] Habit consistency aggregation across rolling 7-day windows.

### Milestone 15: Basic Behavioral Analytics
- [ ] Recharts visualizations for:
  - Time spent by Project and Area.
  - Energy & Clarity correlations with completed deep work hours.
  - Interruption frequency trends.
- [ ] Strict adherence to correlation ≠ causation presentation.

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
