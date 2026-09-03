# Testing Skill

## Purpose

Define how Trajectory should be tested so that the application remains reliable while evolving quickly.

Testing is not a ceremony. The goal is to catch regressions in the parts of the system that matter: task planning, persistence, state transitions, time tracking, habit logging, recovery/compression, and native desktop behavior.

Prioritize tests that provide high confidence at low maintenance cost.

---

## Core Testing Philosophy

1. **Test behavior, not implementation details.**
2. **Prefer deterministic tests.**
3. **Test domain logic heavily.**
4. **Test persistence boundaries explicitly.**
5. **Keep UI tests focused on meaningful user behavior.**
6. **Use end-to-end tests for critical workflows, not everything.**
7. **Do not mock the entire application into meaninglessness.**
8. **Every bug that matters should become a regression test when practical.**
9. **Tests should be fast enough to run continuously during development.**
10. **Do not add tests merely to increase coverage numbers.**

The desired testing pyramid is:

- Many unit/domain tests
- A meaningful number of repository/integration tests
- A smaller number of component/UI tests
- A small set of high-value end-to-end tests

---

## Required Tooling

Use:

- **Vitest** for unit and integration tests
- **React Testing Library** for React component behavior
- **Playwright** for end-to-end desktop/web UI workflows where useful
- Tauri's Rust test facilities for native Rust-side logic when applicable

Keep test tooling aligned with the existing project stack. Do not introduce another test framework without a strong reason.

---

## What Must Be Tested

### 1. Domain Logic

Domain logic is the highest-priority testing target.

Test:

- Task status transitions
- Importance ordering
- Cognitive-demand classification
- Task prioritization
- Workload calculation
- Day compression
- Minimum viable day selection
- Deferral logic
- Habit target evaluation
- Habit consistency calculations
- Work-session duration calculations
- Daily state handling
- Review aggregation
- Rabbit-hole conversion rules
- Brain-dump classification/parsing boundaries
- Planning estimates versus actuals
- Date/time boundary behavior

Example:

Given a day with:

- 1 critical task
- 2 important tasks
- 4 optional tasks
- insufficient available time

the compression algorithm should preserve critical work and select the highest-value feasible work rather than simply taking tasks in insertion order.

Domain tests should not require React, SQLite, or Tauri.

---

## 2. Repository and Persistence Tests

Repository behavior must be tested against a real SQLite database whenever practical.

Test:

- Database initialization
- Migrations
- CRUD operations
- Foreign-key relationships
- Transactions
- Constraint behavior
- Ordering/filtering
- Date-range queries
- Work-session persistence
- Habit log persistence
- Daily state persistence
- Daily review persistence
- Rabbit-hole provenance
- Historical data preservation
- Soft deletion where applicable

Prefer a temporary test database over mocking SQLite.

The purpose is to verify that the application actually works against the persistence layer it will use in production.

---

## 3. Migration Tests

Every schema migration must be safe and deterministic.

Test that:

1. A fresh database reaches the current schema.
2. A database at the previous schema version can migrate successfully.
3. Existing data survives migration.
4. New constraints behave correctly.
5. Migration order is deterministic.
6. Migrations do not silently destroy historical data.

When a migration changes important historical data, add an explicit regression test demonstrating preservation.

Never casually rewrite migrations that have already shipped.

---

## 4. Application State Tests

Test Zustand/application-state behavior where meaningful.

Examples:

- Starting a task updates the active task.
- Starting a work session records the correct task.
- Pausing a session preserves accumulated time.
- Completing a task updates its status and completion timestamp.
- Capturing a rabbit hole does not interrupt the active task.
- Switching modes updates the appropriate execution context.
- Daily state changes persist correctly.
- Day compression does not mutate the user's underlying task data unexpectedly.

Avoid testing Zustand internals. Test observable state transitions.

---

## 5. UI Component Tests

Use React Testing Library to test user-visible behavior.

Good tests:

- User can create a task.
- User can edit task metadata.
- User can complete a task.
- User can start/pause deep work.
- User can capture a rabbit hole without leaving the current workflow.
- User can record daily state.
- User can log a habit.
- User can submit a daily review.
- Empty states render correctly.
- Error states communicate actionable information.
- Keyboard shortcuts trigger the intended behavior where practical.

Avoid tests such as:

- "component has exactly three divs"
- implementation-specific class names
- internal component state that users cannot observe
- snapshots for large dynamic UI trees

Prefer semantic queries:

- `getByRole`
- `getByLabelText`
- `getByText`
- `getByPlaceholderText` when appropriate

---

## 6. Today Screen Tests

The Today screen is the primary execution surface and therefore deserves strong behavioral coverage.

Test that:

- The primary objective is visible when configured.
- Must-do tasks are distinguishable from should-do and optional work.
- Current/next task is represented correctly.
- Current state is visible.
- Habit progress is accurate.
- Workload reflects available time.
- Completed tasks disappear or move according to the intended UX.
- Compression/survival mode produces the expected reduced plan.
- Quick capture works without disrupting execution.

The Today screen should not require the entire application to be mocked just to render.

---

## 7. Deep Work Tests

Deep Work is a critical workflow.

Test:

- Start
- Pause
- Resume
- Finish
- Cancel
- Session duration
- Task association
- Interruption count
- Notes
- Completion state
- Recovery after accidental navigation
- Persistence after app restart when applicable

Important invariant:

> A work session's recorded duration must represent actual elapsed working-session time according to the application's defined semantics, not merely the difference between arbitrary UI timestamps.

Test edge cases around pausing, resuming, midnight, and application interruption.

---

## 8. Habit Tests

Habit tracking must measure consistency without creating streak anxiety.

Test:

- Normal target
- Minimum viable target
- Partial completion
- Exact target completion
- Values above target
- Missed days
- Multiple logs for a day if supported
- Aggregation across date ranges
- Editing historical logs
- Preservation of raw values

Example:

A meditation habit with:

- Normal target = 60 minutes
- Minimum target = 5 minutes

should distinguish between:

- 0 minutes
- 5 minutes
- 30 minutes
- 60 minutes
- 90 minutes

Do not reduce these states to a simplistic streak boolean.

---

## 9. Day Compression Tests

Day compression is safety-critical to the product's philosophy.

Test scenarios including:

- Plenty of available time
- Slightly overloaded day
- Severely overloaded day
- Only critical work fits
- Critical task exceeds remaining time
- Multiple equal-priority tasks
- Different cognitive demands
- Fixed/deadline-bound tasks
- Completed tasks
- Deferred tasks
- Optional tasks
- Empty task list

Verify that compression changes the **plan**, not the underlying historical task records.

Compression should be deterministic: the same inputs should produce the same result.

---

## 10. Minimum Viable Day Tests

Test that the fallback plan:

- Preserves essential commitments.
- Selects minimum viable habit targets where appropriate.
- Does not erase normal targets.
- Does not mark uncompleted work as completed.
- Remains achievable under constrained time.
- Produces a coherent executable plan.

The system should optimize for maintaining trajectory, not pretending the original plan was completed.

---

## 11. Rabbit Hole Tests

Rabbit-hole capture should be nearly frictionless.

Test:

- Capture while another task is active.
- Capture with minimal text.
- Capture with long text.
- Preserve timestamp.
- Preserve source/current-task provenance.
- Convert to task.
- Convert to research item/idea if supported.
- Leave uncategorized items intact.
- Ensure capture does not modify the active work session.

A rabbit hole should never disappear merely because the user captured it quickly.

---

## 12. Brain Dump Tests

The brain dump is intentionally messy.

Test:

- Empty input
- Short input
- Multi-line input
- Multiple possible tasks
- Ideas mixed with tasks
- Research questions
- Personal notes
- Ambiguous statements
- Conversion into structured objects
- Preservation of original raw text

If an LLM parser is introduced later:

- Never make the core application depend on the LLM being available.
- Test deterministic fallback behavior.
- Validate all structured LLM output.
- Reject malformed output safely.
- Preserve the original brain dump.
- Never silently create destructive changes from an AI interpretation.

AI output is untrusted input.

---

## 13. Daily and Weekly Review Tests

Test aggregation correctness.

Daily review should correctly represent:

- Completed work
- Deferred work
- Abandoned work
- Time spent
- State information
- Habit activity
- User-entered reflection

Weekly review should correctly aggregate:

- Planned versus actual work
- Completion/deferment/abandonment
- Habit consistency
- Time by project
- Estimate accuracy
- Work sessions
- Relevant state patterns

Do not infer causality from observational metrics.

If analytics say that low energy is associated with lower completion, the system must not represent that as "low energy causes low productivity."

---

## 14. Time and Date Testing

Time is a major source of subtle bugs.

Explicitly test:

- Midnight boundaries
- Different local dates
- Daylight-saving transitions where applicable
- UTC/local conversion
- Due dates
- Date-range queries
- Work sessions spanning midnight
- Habit logs around midnight
- Weekly boundaries
- Month boundaries
- Year boundaries

Store timestamps consistently according to the architecture defined in `database/SKILL.md`, and test conversions at application boundaries.

Avoid relying on the machine's current clock in deterministic tests.

Use injected/fake clocks where practical.

---

## 15. Native Tauri Tests

Native behavior should be tested at the boundary where it matters.

Test:

- Database initialization
- Tauri commands
- Input validation
- File-system operations
- Notification invocation
- Window behavior
- Tray behavior when implemented
- Keyboard shortcut registration where testable
- Permission/capability assumptions

Do not duplicate frontend tests in Rust unless the native layer owns the relevant behavior.

For every native command:

- Validate inputs.
- Return structured errors.
- Test success.
- Test expected failure.
- Test malformed input.

---

## 16. End-to-End Tests

E2E tests should represent complete user workflows.

High-value scenarios:

### First Launch

1. Launch application.
2. Create an area/project.
3. Create a task.
4. Schedule it.
5. Verify it appears in Today.

### Execution

1. Open Today.
2. Start a task.
3. Enter Deep Work.
4. Pause.
5. Resume.
6. Finish.
7. Verify recorded work session.
8. Verify task state.

### Rabbit Hole

1. Start a task.
2. Capture a rabbit hole.
3. Continue the task.
4. Later convert the rabbit hole.
5. Verify provenance.

### Recovery

1. Create an overloaded day.
2. Trigger compression.
3. Verify critical work remains.
4. Verify lower-priority work is deferred rather than deleted.

### Daily Shutdown

1. Complete work.
2. Open daily review.
3. Record reflection/state.
4. Finish review.
5. Verify tomorrow starts from persisted data.

Keep E2E tests few and high-value because they are slower and more brittle.

---

## Test Data and Fixtures

Prefer small explicit fixtures.

Good:

```ts
const criticalTask = makeTask({
  title: "Finish benchmark",
  importance: "critical",
  estimatedMinutes: 90,
});
```

Avoid giant fixtures containing irrelevant fields unless the test genuinely needs them.

Use factories/builders for repeated domain objects.

Test fixtures should make the scenario obvious.

---

## Mocking Rules

Mock only at meaningful boundaries.

Good candidates:

- System clock
- External AI provider
- OS notification service
- Network services
- Truly nondeterministic dependencies

Avoid mocking:

- Domain logic
- SQLite when testing repositories
- Zustand when testing application-state behavior
- Every child React component

If a test requires extensive mocking to prove a simple behavior, reconsider the architecture.

---

## Regression Testing

When fixing a bug:

1. Reproduce it.
2. Write the smallest test that fails because of the bug.
3. Fix the bug.
4. Verify the regression test passes.
5. Keep the test permanently unless the behavior is intentionally removed.

Bug reports should become executable knowledge whenever practical.

---

## Property and Invariant Testing

Use property-based testing selectively for logic with strong invariants.

Useful candidates:

- Task prioritization
- Day compression
- Time aggregation
- Habit aggregation
- Date-range calculations

Examples of invariants:

- Completed time cannot become negative.
- Compression cannot create tasks.
- Compression cannot delete tasks.
- A task cannot simultaneously be completed and active.
- A work session cannot have negative duration.
- Habit aggregation should be monotonic when additional valid positive observations are added.
- Historical records should remain unchanged by replanning.

Do not introduce property-based testing everywhere. Use it where it catches classes of bugs that example-based tests miss.

---

## Coverage

Coverage is a diagnostic signal, not the goal.

Prioritize coverage of:

1. Domain logic
2. Persistence
3. State transitions
4. Critical execution workflows
5. Failure paths
6. Time/date logic

Do not chase 100% coverage by adding meaningless assertions.

A 70% meaningful test suite is preferable to 95% test theatre.

---

## Test Naming

Test names should describe behavior.

Prefer:

```ts
it("preserves critical tasks when compressing an overloaded day")
```

over:

```ts
it("calls compressTasks correctly")
```

For user-facing tests:

```ts
it("captures a rabbit hole without interrupting the active work session")
```

Names should make failures understandable without reading the implementation.

---

## Test Organization

Prefer colocating tests with the code they validate when practical.

Example:

```text
src/
├── domain/
│   ├── planner/
│   │   ├── compression.ts
│   │   └── compression.test.ts
│   └── habits/
│       ├── consistency.ts
│       └── consistency.test.ts
├── repositories/
│   ├── taskRepository.ts
│   └── taskRepository.test.ts
├── components/
│   ├── Today/
│   │   ├── Today.tsx
│   │   └── Today.test.tsx
└── e2e/
    ├── first-launch.spec.ts
    └── deep-work.spec.ts
```

Follow the project's existing organization if it is already coherent.

---

## Verification Workflow

After implementing a feature:

1. Run formatting.
2. Run type checking.
3. Run unit tests.
4. Run integration/repository tests.
5. Run relevant UI tests.
6. Run E2E tests when the feature affects a critical workflow.
7. Build the application.
8. Launch the application when UI/native behavior changed.
9. Manually verify the changed workflow.
10. Review the diff for accidental scope expansion.

Do not claim a feature is verified merely because TypeScript compiles.

---

## Before Merging a Feature

Ask:

- Does the domain logic have tests?
- Are persistence changes covered?
- Are failure paths tested?
- Are date/time edge cases relevant?
- Does the UI test actual user behavior?
- Is there a regression test for any bug fixed?
- Did the feature introduce unnecessary mocks?
- Did the feature alter historical data semantics?
- Did the feature affect native behavior?
- Does the application still build successfully?

---

## Testing Anti-Patterns

Do not:

- Test implementation details instead of behavior.
- Mock SQLite everywhere.
- Use snapshots as the primary UI testing strategy.
- Depend on real wall-clock time.
- Depend on network access for ordinary tests.
- Create huge fixtures.
- Write brittle selectors tied to CSS.
- Ignore error paths.
- Treat coverage percentage as quality.
- Add E2E tests for every tiny component.
- Delete failing tests merely because they are inconvenient.
- Make tests pass by weakening assertions.
- Introduce sleeps/timeouts when deterministic synchronization is possible.

---

## Definition of Done

A feature is not considered complete merely because it works manually.

For a meaningful feature, "done" means:

- Domain behavior is tested.
- Persistence behavior is tested when applicable.
- User-visible behavior is tested when applicable.
- Failure paths are covered.
- Relevant edge cases are covered.
- Type checking passes.
- Tests pass.
- The application builds.
- Native behavior is verified when applicable.
- No unrelated regressions are introduced.

The standard is not "maximum tests."

The standard is **confidence that the feature works, remains understandable, and can be changed without quietly breaking Trajectory.**
