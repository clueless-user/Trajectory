# Trajectory — System Architecture

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
│   │   └── sessions/           # Timer formatting, estimate deltas
│   ├── hooks/
│   │   └── useKeyboardShortcuts.ts
│   ├── repositories/           # Database abstraction layer
│   │   ├── database.ts         # Adapter selection, migration runner, default seeds
│   │   ├── migrations/         # 001_initial_schema.sql (reference copy; runtime uses the inline string in database.ts)
│   │   ├── seed/               # Deterministic development/demo dataset (dev-only invocation)
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
│   │   ├── ProjectsView.tsx    # Hierarchy viewer (areas → projects → tasks)
│   │   ├── ReviewView.tsx
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
- **Migration Engine**: Migrations run sequentially on startup, recording applied versions in a `_migrations` meta table.

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
   - A deep work session writes its `work_sessions` row immediately on start with `completed_state: 'paused'`. Finishing promotes that row to `'finished'` with the accumulated running seconds; cancelling deletes it. If the application dies mid-session, the row truthfully records an unfinished session instead of disappearing. (`start_time`/`end_time` are wall-clock brackets; `duration_seconds` counts only running time and excludes paused gaps.) In-flight sessions are not yet re-attachable in the UI after a crash — recovery surfacing is deferred.
   - A native database failure at boot stops the application with an explicit error screen; the app never continues without persistence.
3. **Data Loss Invariant**:
   - Deleting a parent project or goal does not cascade-destroy historical completed task logs; completed tasks retain historical snapshot attributes.
