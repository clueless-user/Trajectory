# Trajectory — System Architecture

> The domain semantic contract — local day, planning state, task status, session
> lifecycle, metric definitions, event catalogue, current-state-vs-history — lives
> in [SEMANTICS.md](SEMANTICS.md) and is authoritative.

## 1. Architectural Philosophy & Layering

Trajectory adheres to a strict layered clean architecture. UI components are purely presentational and communicative; domain rules, algorithms, and persistence mechanics are completely decoupled.

```text
┌─────────────────────────────────────────────────────────┐
│                       React UI                          │
│  (Views: Today, DeepWork, Habits, Review, Scratchpad)   │
└───────────────────────────┬─────────────────────────────┘
                            │ Actions / Selectors
┌───────────────────────────▼─────────────────────────────┐
│                   Application State                     │
│               (Zustand Stores with Zod)                 │
└───────────────────────────┬─────────────────────────────┘
                            │ Pure Domain Calls
┌───────────────────────────▼─────────────────────────────┐
│                    Domain Services                      │
│ (Planner, Day Compression, Consistency, Time Tracking)  │
└───────────────────────────┬─────────────────────────────┘
                            │ Typed Data Operations
┌───────────────────────────▼─────────────────────────────┐
│                      Repositories                       │
│    (TaskRepo, HabitRepo, SessionRepo, StateRepo)        │
└───────────────────────────┬─────────────────────────────┘
                            │ Parameterized SQL / IPC
┌───────────────────────────▼─────────────────────────────┐
│             SQLite / Native Tauri Plugins               │
│      (tauri-plugin-sql, notifications, shell, tray)     │
└─────────────────────────────────────────────────────────┘
```

### Architectural Guardrails
1. **No Raw SQL in UI**: React components never call database queries, raw IPC calls, or SQL strings directly.
2. **Domain Decoupling**: Business logic (day compression algorithm, consistency calculation, work session delta logic) lives in pure TypeScript modules (`src/domain/`) with zero React or Tauri dependencies.
3. **Isomorphic Persistence Interface**: Repositories operate against a unified Database adapter interface. In production Tauri, this executes via `tauri-plugin-sql`. In Vitest test runners, this connects to in-memory SQLite (e.g. `better-sqlite3` or an in-memory SQL driver), enabling fast, deterministic persistence testing without mock theater.
4. **Observable State Transitions**: Zustand manages in-memory reactivity. State changes flow unidirectionally.

---

## 2. Technology Stack & Rationale

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Desktop Shell** | Tauri 2 (Rust) | Minimal RAM footprint, rapid startup, native OS capabilities without Chromium bloom. Bundle target: NSIS installer. |
| **View Layer** | React 18 + TypeScript | Declarative UI, high component reusability, robust ecosystem. |
| **Styling** | Tailwind CSS | Fast design iteration, custom design tokens, dark-mode first, zero runtime overhead. |
| **State Management** | Zustand | Boilerplate-free, store slices, outside-of-React subscription capability. |
| **Validation** | Zod | Domain types are inferred from Zod schemas; runtime parsing at repository boundaries is planned but not yet enforced. |
| **Icons** | Lucide React | Clean, minimalist, consistent aesthetic glyphs. |
| **Visualizations** | Recharts | Low-friction, composable charts for behavioral analytics (installed, not yet used). |
| **Persistence** | SQLite (`tauri-plugin-sql`) | Robust ACID compliance, single file, local-first, zero server latency. In-memory `sql.js` powers browser dev and tests through the same adapter interface. |
| **Testing** | Vitest + React Testing Library | Real in-memory SQLite integration tests. Playwright E2E is planned for Phase 3 and not yet installed. |
| **Package Manager** | pnpm | Fast, disk-efficient, strict dependency resolution. |

---

## 3. Directory Layout

The codebase is organized logically by layer and domain:

```text
trajectory/
├── .agents/                    # Agent guidance, rules, skills, knowledge graph
│   ├── rules/
│   │   └── project.md
│   ├── skills/                 # database, product-design, tauri-engineering, testing, ui-design
│   ├── workflows/              # build-feature, review, release
│   └── KNOWLEDGE_GRAPH.md      # Living repo map: architecture, gotchas, verification ledger
├── docs/                       # Permanent living specifications
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── PRODUCT.md
│   └── ROADMAP.md
├── src/                        # Frontend application code
│   ├── components/
│   │   ├── common/             # Badge, Button, Modal, ProgressBar, Slider
│   │   ├── layout/             # Header, Sidebar
│   │   ├── CommandPaletteModal.tsx
│   │   ├── CompressionModal.tsx
│   │   ├── NewTaskModal.tsx
│   │   └── RabbitHoleModal.tsx
│   ├── domain/                 # Pure domain business logic (no React/DOM)
│   │   ├── compression/        # Day compression algorithm
│   │   ├── habits/             # Target evaluation, rolling consistency scoring
│   │   ├── models/             # Zod schemas + inferred TypeScript types
│   │   ├── time/               # Shared local-date utilities (single source of day semantics)
│   │   └── sessions/           # Timer formatting, estimate deltas
│   ├── hooks/
│   │   └── useKeyboardShortcuts.ts
│   ├── repositories/           # Database abstraction layer
│   │   ├── database.ts         # Adapter selection, version-map migration runner, default seeds
│   │   ├── migrations/         # 001_initial_schema.sql (reference copy; runtime uses the inline strings in database.ts)
│   │   ├── seed/               # Deterministic development/demo dataset (dev-only invocation)
│   │   ├── eventLogRepository.ts  # Append-only behavioural instrumentation (migration 002)
│   │   ├── brainDumpRepository.ts
│   │   ├── habitRepository.ts
│   │   ├── rabbitHoleRepository.ts
│   │   ├── reviewRepository.ts
│   │   ├── stateRepository.ts
│   │   ├── taskRepository.ts
│   │   └── workSessionRepository.ts
│   ├── stores/                 # Zustand application state
│   │   ├── useHabitStore.ts
│   │   ├── useReviewStore.ts
│   │   ├── useSessionStore.ts
│   │   ├── useStateStore.ts
│   │   ├── useTaskStore.ts
│   │   └── useUIStore.ts
│   ├── views/                  # Primary application screens
│   │   ├── BrainDumpView.tsx
│   │   ├── DeepWorkView.tsx
│   │   ├── HabitsView.tsx
│   │   ├── PlannerView.tsx     # Kanban board over Task.status (drag & drop)
│   │   ├── ProjectsView.tsx    # Hierarchy viewer (areas → projects → tasks)
│   │   ├── ReviewView.tsx      # Shutdown review + rabbit-hole capture backlog
│   │   └── TodayView.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── vite-env.d.ts
├── src-tauri/                  # Tauri 2 Rust Desktop Backend
│   ├── capabilities/           # Security capability permissions (sql + notification, least privilege)
│   ├── icons/                  # Generated desktop icon set (icon.ico required for Windows builds)
│   ├── src/
│   │   ├── lib.rs              # Plugin registration: tauri_plugin_sql, tauri_plugin_notification
│   │   └── main.rs
│   ├── Cargo.toml
│   ├── Cargo.lock
│   └── tauri.conf.json
├── index.html
├── package.json
├── pnpm-lock.yaml
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 3.5 Behavioural Synthesis Layer (Phase 2B)

```txt
UI (WeeklyReview) -> behaviorService -> repositories (date-bounded queries)
                                     -> src/domain/behavior/* (pure aggregation)
                                     -> WeeklyBehaviorFacts (typed contract)
```

- The UI renders the structured facts object only; no aggregation in React.
- The event log is a read model now: bounded range/type queries, typed payload
  schemas parsed defensively (malformed events become coverage warnings).
- Historical planned workload comes from `planning.day_snapshot` events
  (dedupe by signature, writes serialized in useTaskStore).
- Strictly descriptive: every pattern carries evidence + confidence; no
  prediction/ranking/causal language (docs/SEMANTICS.md §9.6).

## 4. Database & Persistence Architecture

### The Database Adapter
The persistence layer provides an asynchronous interface:
```typescript
export interface DatabaseAdapter {
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}
```
This guarantees:
- **Zero vendor lock-in**: We can run identical repository code inside Tauri's native SQLite plugin and in Node/Vitest test suites.
- **Strict Parameterization**: All queries use parameterized placeholders (`?`), preventing SQL injection and formatting anomalies.
- **Migration Engine**: Migrations run sequentially on startup from an ordered version map, recording applied versions in a `_migrations` meta table. Migration 001 creates the base schema; migration 002 adds the `event_log` behavioural table. All DDL is idempotent.
- **Runtime validation**: task, work-session and habit-log records are parsed with their Zod schemas at the repository boundary — corrupt rows fail loudly instead of flowing into the UI.

### Native Boundary & Production Database Path
- The Tauri runtime registers exactly two plugins (`tauri-plugin-sql` with the sqlite feature, `tauri-plugin-notification`); no custom Rust commands exist — the entire frontend/native data boundary is the SQL plugin.
- `initializeDatabase()` detects the native environment via `window.__TAURI_INTERNALS__`. **Inside Tauri there is deliberately no fallback**: if the native database cannot be opened, boot fails into an explicit error screen rather than silently running on a disposable in-memory database. Browser development and tests use the in-memory `sql.js` adapter.
- Production database: `sqlite:trajectory.db`, resolved by the SQL plugin to the per-user application config directory — **`%APPDATA%\com.trajectory.app\trajectory.db`** on Windows. SQLite runs in WAL mode; pending writes live in `trajectory.db-wal` until a checkpoint (committed on clean app close), so the main file alone may lag the live state while the app runs.
- The schema upgrade path: `runMigrations` creates `_migrations` first, reads applied versions, and executes only unapplied migrations. Migration 001 ships as an inline string in `database.ts` (the file `src/repositories/migrations/001_initial_schema.sql` is a reference copy kept in sync manually). All 001 DDL is idempotent (`IF NOT EXISTS`). Only one migration exists so far — no upgrade history has been manufactured.
- On a fresh database, default seed data is inserted (4 life areas and 4 dual-target habits with fixed UUIDs). A separate, deterministic development/demo dataset exists in `src/repositories/seed/devSeed.ts`; it is only invocable from the command palette in dev builds and refuses to run when any real task exists.

---

## 5. Keyboard Navigation & Global Shortcut Architecture

Trajectory is engineered for high-velocity keyboard operation:

- `N`: Create new task in active view.
- `D`: Open Quick Brain Dump scratchpad.
- `R`: Instant Rabbit Hole capture modal (non-blocking overlay).
- `Space`: Start / Pause current deep work timer (when not focused on text input).
- `Enter`: Edit focused item / confirm dialog.
- `Esc`: Dismiss modal / cancel capture / return to default view.
- `Ctrl+K` / `Cmd+K`: Global command palette.

Input fields automatically suppress single-key hotkeys to prevent unintentional triggering during text editing.

---

## 6. Error Handling & Recovery Strategy

1. **User-Centric Errors**: Error alerts display:
   - What happened in plain language.
   - Which task/record was affected.
   - Immediate actionable remedy (e.g., Retry, Revert, Save as Draft).
2. **Crash & State Resilience**:
   - A deep work session writes its `work_sessions` row immediately on start with `completed_state: 'paused'`. Finishing promotes that row to `'finished'` with the accumulated running seconds; cancelling deletes it. If the application dies mid-session, the row truthfully records an unfinished session instead of disappearing. (`start_time`/`end_time` are wall-clock brackets; `duration_seconds` counts only running time and excludes paused gaps.)
   - Interrupted (paused) rows are surfaced on the Today screen at the next launch: **Keep Record** finalizes them as `'interrupted'` (end time = recovery moment; duration stays 0 because true worked time is unknown) and **Discard** removes the tombstone.
   - Elapsed time is derived from wall-clock timestamps (accumulated seconds + a running-since marker), not from interval ticks, and the one-second display refresh is owned by the session store — view unmounts, background throttling, and navigation cannot distort recorded durations.
   - A native database failure at boot stops the application with an explicit error screen; the app never continues without persistence.

3. **Behavioural Instrumentation**:
   - An append-only `event_log` table records important lifecycle events (task created/status-changed/details-updated/deferred, session started/paused/resumed/finished/cancelled/recovered/discarded, habit logged, review saved, rabbit hole captured/converted/archived). Writes are fire-and-forget from the stores (and from the rabbit-hole repository write boundary) and must never delay or break user actions.

4. **Day Semantics**:
   - All "today" computation flows through `src/domain/time/date.ts`: daily surfaces follow the user's LOCAL calendar day while stored timestamps remain UTC ISO-8601. Date-only arithmetic is UTC-safe string math.
   - `useDayRollover` reloads all today-keyed stores when the local day changes while the app is open (30s check + window focus) — midnight never leaves stale "today" data on screen.

5. **The Now Console (TodayView)**:
   - Priority hierarchy: recovery banner → primary objective (persisted per-day) → quick capture → NOW cockpit → NEXT card → plan horizon → workload/state/habits rail.
   - The cockpit runs execution inline: Start/Pause/Resume create and transition work sessions without navigation (the Deep Work cockpit remains one click away for focus mode). Completing or deferring the active task settles the running session first, so no timer is ever orphaned on a finished or deferred task.
   - The recovery banner lists interrupted sessions with Resume (adopts the same session row — never a duplicate), Keep Record (finalizes `'interrupted'`), and Discard (deletes).
   - Execution metrics come exclusively from `src/domain/metrics.ts` (`plannedLoadMinutes`, `remainingLoadMinutes`, `loggedWorkMinutes`, `remainingEstimateMinutes`) — planned-vs-logged and estimate-vs-actual are never conflated.
   - Planning state (objective + available minutes) persists in `planning_state` per local day, owned by `useTaskStore`; the review→morning objective handoff happens at load time and is event-logged.
   - Projects/areas are read through `projectRepository` — no view executes raw SQL.
3. **Data Loss Invariant**:
   - Deleting a parent project or goal does not cascade-destroy historical completed task logs; completed tasks retain historical snapshot attributes.
