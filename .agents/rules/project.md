---
trigger: always_on
---

# Project Rule — Trajectory

You are the primary engineering agent for Trajectory.

Trajectory is a personal operating system / daily planner designed for a cognitively intense user managing multiple parallel domains of work.

The product philosophy is:

- Execution over configuration.
- Low friction over feature abundance.
- Adaptive planning over rigid scheduling.
- Behavioural data over productivity theatre.
- Recovery over guilt.
- Curiosity is allowed, but captured rather than allowed to derail execution.
- The application should learn the user's actual behaviour over time.

## Technical Stack

Frontend:
- React
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- Zod
- Lucide icons
- Recharts where visualization is useful

Desktop:
- Tauri 2
- Rust

Persistence:
- SQLite through the official Tauri SQL plugin.

Native functionality:
- Use Tauri plugins for filesystem access, notifications, tray integration, and other native functionality.
- Do not implement native functionality through browser APIs when a Tauri-native solution exists.

## Architecture

Prefer a clean separation:

UI
↓
Application state
↓
Domain services
↓
Persistence / Tauri APIs

React components must not contain raw SQL queries.

Database access belongs in dedicated repository/service modules.

Business logic must not depend directly on UI components.

Use typed domain models.

Avoid global mutable state except through the designated state-management layer.

## Product Behaviour

The application should never punish the user for missing tasks.

Never implement:
- guilt-inducing language
- productivity scores that imply personal worth
- destructive streak mechanics
- excessive notification spam

Prefer:
- recovery
- compression
- minimum viable habits
- adaptive scheduling
- historical behavioural insights

## UX

The primary question answered by the application is:

"What should I actually do right now?"

The application should not require extensive configuration before becoming useful.

Prioritize:
1. Today
2. Current task
3. Energy/state
4. Habits
5. Quick capture
6. Review

## Development Behaviour

Before implementing a substantial feature:

1. Inspect the existing architecture.
2. Identify affected files.
3. Explain the implementation plan.
4. Check whether an existing abstraction should be reused.
5. Implement the smallest coherent version.
6. Run formatting.
7. Run type checking.
8. Run tests.
9. Run the application when visual verification is relevant.
10. Report what changed and what was verified.

Do not rewrite working architecture merely to introduce a preferred pattern.

Do not add dependencies unless they provide meaningful value.

Do not silently change the product specification.

When requirements are ambiguous, identify the ambiguity before making a consequential architectural decision.

## Quality Bar

Code should be boring, explicit and maintainable.

Prefer simple abstractions over clever abstractions.

Avoid premature generalization.

Avoid massive components.

Keep components focused.

Keep domain logic testable independently of React.

Every persistent data structure must have a migration strategy.

Every feature that modifies persistent state must have tests for its important state transitions.