# Trajectory — Product Specification

## 1. Product Mission & Philosophy

**Trajectory** is a local-first native desktop personal operating system engineered specifically for a cognitively intense user managing multiple parallel domains of work, research, and life.

Trajectory is **not** a generic productivity SaaS or another task manager the user has to manage. It is built upon six foundational axioms:

1. **Execution over configuration**: Minimal setup required. Opening the app immediately answers: *"What should I actually be doing right now?"*
2. **Trajectory over perfection**: A bad day that accomplishes 10% of a target still preserves momentum. Streaks and perfectionism cause guilt and dropout; Trajectory encourages continuity.
3. **Recovery over guilt**: When schedules blow up or energy drops, the system deterministically compresses the day, preserving high-leverage work without judgment or shame.
4. **Behavioral data over productivity theatre**: Long-term tracking produces observable behavioral patterns (estimate accuracy, energy vs. output, completion by time of day) rather than vanity points or gamified badges.
5. **Capture curiosity without derailing execution**: Instant rabbit-hole capture allows cognitive offloading of tangential thoughts without abandoning active deep work.
6. **AI as augmentation, never a dependency**: The application remains completely functional, fast, and local-first without an internet connection or LLM access. Any future AI layer merely parses text or surfaces correlations as an untrusted advisor.

---

## 2. Planning Hierarchy

Trajectory structures user aspirations and work through a 5-tier strictly actionable hierarchy:

```text
Life Area
└── Goal
    └── Project
        └── Task
            └── Action (Subtask / Checkpoint)
```

### Hierarchy Rules
- **Life Area**: Long-term spheres of responsibility (e.g., `Career`, `Health & Vitality`, `AI Systems & Research`, `Personal Operations`).
- **Goal**: Desired concrete outcome within an area (e.g., `High-Performance LLM Inference Engine`).
- **Project**: Discrete initiative with a definable completion boundary (e.g., `KV Cache Paged Memory Optimization`).
- **Task**: An actionable, measurable work unit (e.g., `Benchmark cache layouts with synthetic token workloads`). Tasks must never be vague placeholders like "Read papers" or "Work on project".
- **Action**: Small micro-step or execution checklist item within a task (e.g., `Instrument memory bandwidth counters`).

---

## 3. Core Task Model

Every task in Trajectory possesses structured metadata to facilitate algorithmic planning:

- **Title**: Actionable verb-first phrase.
- **Description / Notes**: Context, links, prerequisites.
- **Project ID / Life Area ID**: Provenance.
- **Importance**:
  - `Critical`: Non-negotiable leverage or external commitment.
  - `Important`: High-value progress towards primary objectives.
  - `Optional`: Low leverage or nice-to-have if surplus capacity exists.
- **Cognitive Demand**:
  - `Deep`: High cognitive load, requires sustained focus, zero distractions (e.g., writing kernel code, proofs).
  - `Medium`: Standard analytical/engineering execution (e.g., code reviews, API wiring).
  - `Shallow`: Low cognitive friction, administrative, low energy (e.g., email, organizing files, filing receipts).
- **Status**:
  - `Inbox`: Quick-captured, awaiting scheduling or prioritization.
  - `Planned`: Scheduled for a specific date/session.
  - `In Progress`: Currently being executed or active.
  - `Completed`: Finished with recorded completion timestamp.
  - `Cancelled`: Intentionally abandoned.
  - `Deferred`: Pushed to future review/backlog without guilt.
- **Estimated Duration**: Minutes expected.
- **Actual Duration**: Accumulated active deep work session minutes.
- **Due Date / Scheduled Date**: Timestamps with timezone safety.
- **Timestamps**: `created_at`, `updated_at`, `completed_at`.

---

## 4. Primary Surface: The Today View

The Today screen is **not** a noisy dashboard with dozens of widgets. It is a unified execution command center designed to eliminate decision paralysis:

1. **Primary Objective**: The single non-negotiable mission for the day.
2. **Now (Active / Next Up)**: The single task selected for immediate execution, showing cognitive demand and estimated time.
3. **Must-Do (Critical)**: Non-negotiable tasks that must get done.
4. **Should-Do (Important)**: High-leverage tasks planned for today.
5. **Optional**: Secondary items executed only if energy and time permit.
6. **Current State**: Lightweight 4-metric slider snapshot (Energy, Clarity, Stress, Social Battery).
7. **Habit Progress**: Continuous progress bars towards normal and minimum viable targets.
8. **Workload Meter**: Visual budget comparing estimated minutes vs. available execution minutes.
9. **Quick Capture**: Hotkey-driven instant input for tasks and thoughts.

---

## 5. Day Compression & Survival Mode

When a user falls behind schedule (e.g., a meeting overruns, an unexpected interruption occurs, or an energy crash strikes):

- **Algorithm**:
  1. Computes remaining available working minutes in the day.
  2. Preserves hard time commitments and `Critical` tasks.
  3. Sorts `Important` tasks by leverage, retaining only what realistically fits.
  4. Automatically transitions remaining unexecuted tasks to `Deferred`.
- **Invariants**:
  - Compression mutates the **plan**, never historical records or truth.
  - Zero shame language: presents options cleanly (e.g., *"Current plan exceeds remaining time by 2h 15m. Compress day?"*).
  - Deterministic and testable behavior.

---

## 6. Habits: Minimum Viable Day Architecture

Habits measure continuous behavioral consistency rather than fragile binary streaks:

- **Dual Targets**:
  - **Normal Target**: The optimal standard (e.g., Meditation: 60 min, Workout: 45 min).
  - **Minimum Viable Target (MVD)**: The floor requirement to maintain neural trajectory on bad days (e.g., Meditation: 5 min, Workout: 10 min).
- **Continuous Logging**:
  - Distinguishes 0 min, 5 min, 30 min, 60 min, 90 min rather than a binary `done/not done`.
- **Guilt-Free Consistency**:
  - Consistency is calculated as a rolling score / probability density over time. A missed day or minimum day never resets your progress to zero.

---

## 7. Deep Work Mode

A dedicated distraction-free execution cockpit:

- Shows only:
  - Active task & primary objective
  - Elapsed / countdown timer
  - Pause / Resume controls
  - Finish & Complete button
  - Interruption counter with quick reason capture
  - Live session notes
- **Data Persistence**:
  - Every session writes a permanent record: `task_id`, `start_time`, `end_time`, `actual_duration_seconds`, `interruption_count`, `completed_flag`, `notes`.
  - Distinguishes actual active working time from wall-clock pauses.

---

## 8. Curiosity & Rabbit Holes

Cognitively intense individuals frequently encounter compelling tangent ideas during deep work. Suppressing them causes cognitive friction; indulging them causes derailment.

- **Instant Hotkey (`R`)**: Opens a lightweight capture modal that overlays the screen without pausing the deep work timer.
- **Provenance**: Records the exact task and project active when the rabbit hole occurred.
- **Conversion Workflow**: During shutdown or review, rabbit holes can be converted into:
  - A new Task
  - A Project
  - A Research item
  - An Idea backlog item
  - Discarded / Archived

---

## 9. Brain Dump & Scratchpad

A persistent unstructured canvas for cognitive offloading:

- Freeform text input for fragmented thoughts, links, and half-baked ideas.
- Always preserves raw text history.
- Built with an extensible modular boundary for future rule-based or local-LLM classification into structured tasks and goals.

---

## 10. Daily & Weekly Review

### Daily Review (Target: 90 Seconds)
Executed at evening shutdown:
1. What was completed vs. deferred?
2. What drained energy today?
3. What energized you?
4. What is the single primary objective for tomorrow?
5. Final state assessment.

### Weekly Review
Synthesizes behavioral observations across 7 days:
- Planned vs. actual execution ratio.
- Estimation bias (Estimated minutes vs. Actual recorded minutes by project/type).
- Habit trajectory & resilience.
- Cognitive demand distribution (Deep vs. Shallow ratio).
- **Epistemological Constraint**: Surfaces observational associations (e.g., *"Deep work sessions started before 11:00 AM had 40% fewer interruptions"*), but **never** makes unscientific causal claims.
