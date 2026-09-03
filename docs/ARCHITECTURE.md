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
| **Desktop Shell** | Tauri 2 (Rust) | Minimal RAM footprint (<40MB), rapid startup, native OS capabilities without Chromium bloat. |
| **View Layer** | React 19 + TypeScript | Declarative UI, high component reusability, robust ecosystem. |
| **Styling** | Tailwind CSS | Fast design iteration, custom design tokens, dark-mode first, zero runtime overhead. |
| **State Management** | Zustand | Boilerplate-free, store slices, outside-of-React subscription capability. |
| **Validation** | Zod | Runtime type validation at persistence and native boundaries. |
| **Icons** | Lucide React | Clean, minimalist, consistent aesthetic glyphs. |
| **Visualizations** | Recharts | Low-friction, composable charts for behavioral analytics. |
| **Persistence** | SQLite (`tauri-plugin-sql`) | Robust ACID compliance, single file, local-first, zero server latency. |
| **Testing** | Vitest + RTL + Playwright | Sub-second unit/integration execution, real browser/desktop E2E flows. |
| **Package Manager** | pnpm | Fast, disk-efficient, strict dependency resolution. |

---

## 3. Directory Layout

The codebase is organized logically by layer and domain:

```text
trajectory/
├── .agents/                    # Agent guidance, rules, and skill definitions
│   ├── rules/
│   │   └── project.md
│   ├── skills/
│   │   ├── database/
│   │   ├── product-design/
│   │   ├── tauri-engineering/
│   │   ├── testing/
│   │   └── ui-design/
│   └── workflows/
│       ├── build-feature.md
│       ├── review.md
│       └── release.md
├── docs/                       # Permanent living specifications
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── PRODUCT.md
│   └── ROADMAP.md
├── src/                        # Frontend application code
│   ├── assets/                 # Static fonts, illustrations
│   ├── components/             # Reusable UI components & Design System
│   │   ├── common/             # Button, Modal, Input, Badge, Slider, Tooltip
│   │   ├── layout/             # Header, Navigation, Shell, QuickCaptureBar
│   │   └── modules/            # Domain-specific UI cards/views
│   ├── domain/                 # Pure domain business logic (no React/DOM)
│   │   ├── compression/        # Day compression algorithm
│   │   ├── habits/             # MVD calculations, consistency scoring
│   │   ├── models/             # Pure TypeScript domain types & Zod schemas
│   │   ├── planner/            # Task scheduling, priority sorting
│   │   ├── sessions/           # Work session duration & interruption rules
│   │   └── state/              # Energy, clarity, and friction scores
│   ├── repositories/           # Database abstraction layer
│   │   ├── database.ts         # Connection pool & migration runner
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
│   │   ├── ReviewView.tsx
│   │   └── TodayView.tsx
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── src-tauri/                  # Tauri 2 Rust Desktop Backend
│   ├── capabilities/           # Security capability permissions
│   │   └── default.json
│   ├── migrations/             # Sequential SQL migration scripts
│   │   └── 001_initial_schema.sql
│   ├── src/
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── Cargo.toml
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
   - In-progress deep work sessions periodically flush elapsed time to the repository (every 30 seconds). If the application or OS abruptly restarts, the session is recovered with exact accumulated working seconds.
3. **Data Loss Invariant**:
   - Deleting a parent project or goal does not cascade-destroy historical completed task logs; completed tasks retain historical snapshot attributes.
