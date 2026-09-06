
---
name: database
description: Designs, implements, migrates, and reviews Trajectory's SQLite persistence layer. Use whenever modifying schemas, repositories, migrations, queries, persistence models, event logging, analytics data, or database-related architecture.
---

# Trajectory Database Engineering

Trajectory is a local-first personal operating system.

The database is not merely storage for todos.

It is the long-term behavioural record from which the application can eventually learn:

- how the user plans
- what they actually complete
- how long tasks really take
- when they work best
- what causes interruptions
- how habits behave over time
- how plans differ from reality

Therefore database design must preserve useful historical information.

---

# Database

Use SQLite through Tauri's official SQL plugin.

Do not introduce another database unless explicitly required.

The database must remain local-first.

The application should remain useful without an internet connection.

---

# Architecture

Never access SQLite directly from React components.

Use:

```text
React UI
    ↓
Application state
    ↓
Domain services
    ↓
Repositories
    ↓
SQLite

# Timestamps

Store timestamps as UTC ISO-8601 strings (`new Date().toISOString()`); day keys
(`scheduled_date`, `daily_states.date`, `daily_reviews.date`, `planning_state.date`,
`habit_logs.date`) are the user's LOCAL calendar day as `YYYY-MM-DD`, derived only
through `src/domain/time/date.ts`. Date-only arithmetic uses `addDays` (UTC-anchored
string math). Never compare a day string against an ISO timestamp.

# Validation

Every repository read/write boundary validates rows with the domain Zod schemas
(`src/domain/models/types.ts`). Corrupt rows fail loudly — never flow into the UI.

# Migrations

Sequential, idempotent (`IF NOT EXISTS`), recorded in `_migrations`. Never rewrite
a shipped migration; add a new numbered entry and a fresh-install + upgrade test.