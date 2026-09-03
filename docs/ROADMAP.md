# Trajectory — Engineering Roadmap

This roadmap breaks down the 20 milestones into concrete execution phases. Every phase builds upon verified, tested layers.

---

## Phase 1: Core Foundation & MVP Execution Engine (Milestones 01 – 13)

### Milestone 01: Project Bootstrap
- [x] Create directory layout and `.gitignore`.
- [x] Write architectural, product, data model, and roadmap documentation.
- [ ] Initialize Git repository with initial baseline checkpoint.
- [ ] Bootstrap Vite + React + TypeScript + Tailwind CSS project with `pnpm`.
- [ ] Configure Vitest, React Testing Library, and TypeScript compilation.
- [ ] Bootstrap Tauri 2 desktop shell configuration (`src-tauri`).

### Milestone 02: Design System & Visual Foundation
- [ ] Establish design tokens: typography, high-contrast dark theme (calm, technical, understated), spacing, micro-animations.
- [ ] Build core UI components: `Button`, `Input`, `Slider`, `Modal`, `Badge`, `Card`, `StatusPill`.
- [ ] Build layout frame: App Shell, Sidebar / Mode Switcher, Command Bar.

### Milestone 03: SQLite & Migrations Engine
- [ ] Create migration runner and initial schema (`001_initial_schema.sql`).
- [ ] Implement database adapter supporting both native Tauri SQL plugin and in-memory test runner.
- [ ] Verify migrations and constraints with automated tests.

### Milestone 04: Domain Models & Repositories
- [ ] Define Zod schemas and TypeScript types for all entities: Areas, Goals, Projects, Tasks, Actions, Habits, WorkSessions, DailyStates, DailyReviews, RabbitHoles.
- [ ] Implement typed repository classes with parameterized queries and soft-delete support.
- [ ] Write repository integration tests.

### Milestone 05: Application State Layer
- [ ] Create Zustand stores: `useTaskStore`, `useHabitStore`, `useSessionStore`, `useStateStore`, `useReviewStore`, `useUIStore`.
- [ ] Ensure state updates trigger appropriate persistence calls.
- [ ] Verify state updates and store subscribers via unit tests.

### Milestone 06: Desktop Shell Integration
- [ ] Verify native Tauri 2 windowing, clean title bar, and local persistence.
- [ ] Configure capability permissions for filesystem and SQLite.

### Milestone 07: Today Screen (Primary Surface)
- [ ] Primary Objective display and quick configuration.
- [ ] "Now" active task cockpit with cognitive demand and duration badge.
- [ ] "Up Next" / "Must-Do" / "Should-Do" / "Optional" segmented task lists.
- [ ] Daily State quick-slider widget (Energy, Clarity, Stress, Social).
- [ ] Habit daily completion summary.
- [ ] Workload capacity meter (Estimated minutes vs. available time).
- [ ] Algorithmic Day Compression / Survival Mode trigger.

### Milestone 08: Tasks & Projects Management
- [ ] Complete hierarchy navigation: Life Area → Goal → Project → Task → Action.
- [ ] Inline editing for title, estimated duration, importance, and cognitive demand.
- [ ] Task status transitions (Inbox → Planned → In Progress → Completed / Deferred).

### Milestone 09: Habits & Minimum Viable Day
- [ ] Dual-target habit tracker (Normal vs. Minimum Viable Target).
- [ ] Continuous value logger (numeric input, partial completions).
- [ ] Historical consistency view (no destructive streak resets).

### Milestone 10: Deep Work Mode
- [ ] Distraction-free full-focus cockpit for single active task.
- [ ] High-accuracy timer with pause/resume and elapsed tracker.
- [ ] Non-disruptive interruption counter with quick note capture.
- [ ] Work session auto-save and persistence to `work_sessions`.

### Milestone 11: Rabbit Hole Capture
- [ ] Global overlay (`R` hotkey) for instant tangent capture.
- [ ] Automatic provenance link to active task and project.
- [ ] Rabbit hole backlog management with one-click conversion to Task/Project/Idea.

### Milestone 12: Brain Dump Scratchpad
- [ ] Full-screen frictionless scratchpad for raw thought offloading.
- [ ] Autosave and historical version retention.
- [ ] Extraction tools to promote text blocks into actionable tasks.

### Milestone 13: Daily Review (90-Second Shutdown)
- [ ] Evening reflection wizard:
  1. Review completed vs. deferred work.
  2. Record energy drains and boosters.
  3. Set tomorrow's primary objective.
  4. Final state check.
- [ ] Persist to `daily_reviews`.

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
