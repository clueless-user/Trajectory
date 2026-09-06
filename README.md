# Trajectory

**A local-first personal execution OS.** Trajectory answers one question — *what should I actually be doing right now?* — and records the behavioral truth of your day without judgment. It plans, tracks deep work, captures tangents, and reflects; it never nags, scores your worth, or breaks a streak for punishment.

## What it does

- **Today** — an execution console: your persisted primary objective, a NOW cockpit that starts, pauses, resumes, completes, or defers work inline, a NEXT card, and quick capture (type → Inbox). Interrupted sessions are surfaced on launch for one-click resume; a midnight rollover keeps "today" honest. Workload capacity, energy/state sliders, and habit progress on the side.
- **Planner** — a Kanban board (Inbox → Planned → In Progress → Completed → Deferred) with drag-and-drop. Deferred work is recovery, not failure: drag it back when capacity returns.
- **Deep Work** — a distraction-free timer with pause/resume, interruption logging, and a scratchpad. Sessions survive crashes: the record is written the moment you start, so an interrupted session is surfaced truthfully at next launch.
- **Day Compression** — when the plan exceeds capacity, compression deterministically defers the overflow while preserving critical work. It changes the plan, never the history. Zero shame.
- **Habits** — dual targets (normal + minimum viable) with a rolling consistency score. A minimum day counts at partial credit; nothing ever resets to zero.
- **Rabbit Holes** — hit `R` mid-task, dump the tangent, keep working. Captures carry provenance and wait in the review backlog for conversion or dismissal.
- **Brain Dump** — an unstructured scratchpad; select any text to promote it into a task.
- **Evening Review** — a 90-second shutdown: drains, boosts, tomorrow's single objective, and the rabbit-hole backlog.

## Install & run

Requires [Node](https://nodejs.org) 22+, [pnpm](https://pnpm.io), and the [Rust toolchain](https://rustup.rs) (MSVC) for the desktop build.

```bash
pnpm install

pnpm tauri dev     # native desktop app (first compile takes ~15 min)
pnpm tauri build   # NSIS installer + release exe in src-tauri/target/release/bundle/
```

Frontend-only workflows:

```bash
pnpm dev           # browser dev server (in-memory database — data is not persisted)
pnpm test          # 131 tests against a real in-memory SQLite
pnpm typecheck     # strict TypeScript
pnpm build         # production web bundle
```

## Your data

Everything is **local-first and offline**: a single SQLite file at
`%APPDATA%\com.trajectory.app\trajectory.db` (Windows). No accounts, no sync, no telemetry. Delete the file to start fresh; migrations and default content (4 life areas, 4 dual-target habits) re-create themselves.

A **deterministic development seed** is available in dev builds: Command Palette (`Ctrl+K`) → *Load Development Seed Data (Dev)*. It loads a realistic demo dataset, only into an empty task list, clearly marked — it never mixes with real data.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Ctrl/Cmd+K` | Command palette (↑↓ + Enter to navigate) |
| `N` | New task |
| `R` | Capture rabbit hole |
| `D` | Brain dump |
| `Space` | Pause / resume active session |
| `Esc` | Close modal |

Single-letter shortcuts are suppressed while typing.

## Architecture

```text
React UI (views + Zustand stores)
        ↓
  Domain services (pure TS: compression, consistency, timing, dates)
        ↓
  Repositories (parameterized SQL, Zod-validated at the boundary)
        ↓
  DatabaseAdapter ── tauri-plugin-sql (native SQLite)
                └── sql.js in-memory (tests / browser dev)
```

Tauri 2 + Rust desktop shell; React 18 + TypeScript + Vite + Tailwind; SQLite everywhere with sequential migrations (`_migrations` bookkeeping). A native database failure is a hard boot error — the app never silently runs without persistence. Lifecycle events (tasks, sessions, habits, reviews, rabbit holes) are recorded to an append-only `event_log`.

Deep documentation:

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — product philosophy and behavior specs
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — schema and persistence semantics
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phases, milestones, decision log
- [`.agents/KNOWLEDGE_GRAPH.md`](.agents/KNOWLEDGE_GRAPH.md) — living repo map, verification ledger, gotcha index

## Status

Phase 1 (MVP), Phase 1.5 (native hardening), and Phase 2A (operational completeness) are complete — see the [roadmap](docs/ROADMAP.md). Next up: Phase 2 (weekly review, behavioral analytics, native notifications, system tray).
