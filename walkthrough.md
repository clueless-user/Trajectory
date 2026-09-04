# Trajectory — Phase 1.5 Complete (2026-09-04)

**Status: ALL PHASE GATES GREEN** — typecheck ✅ · **78/78 tests** (10 suites) ✅ · `pnpm build` ✅ · `pnpm tauri dev` ✅ · **native persistence verified end-to-end** ✅ · **`pnpm tauri build` (NSIS installer) succeeded** ✅ · docs synced ✅ · clean git checkpoint ✅

Phase 1.5's objective was to make the MVP skeleton **real, persistent, trustworthy, and usable** — not to add features. That objective is met. Trajectory can now be run as a native Windows app, its data survives restarts, its critical behaviors are pinned by tests, and its docs describe reality.

---

## 1. What was delivered (whole phase, newest first)

| Commit | Content |
| --- | --- |
| *(this commit)* | Docs synced to reality: ARCHITECTURE (native boundary, DB path, real crash-safety design, corrected stack/layout), DATA_MODEL (persistence semantics + seed strategy), ROADMAP (Phase 1.5 section, stale Milestone 01–13 checkboxes corrected), knowledge graph ledger + final walkthrough |
| `497ea8f` | `feat: add realistic development seed data` — deterministic dataset (mulberry32 seed 42, fixed UUIDs): 4 goals / 4 projects / 10 tasks incl. a 435-minute overloaded today-plan, 14 days of mixed habit logs, daily states, work sessions, 2 evening reviews, captured + converted rabbit holes, marked brain dump. Dev-only command palette entry; refuses when real tasks exist. 8 tests. |
| `81563a2` | `fix: reflect accrued session minutes in the task store immediately` — confirmed during the manual exercise: the cockpit showed no "Logged" time after finishing a session because only the DB was updated. |
| `48113ae` | `test: strengthen critical execution paths` — 16 → 70 tests: compression edge matrix (13), session lifecycle with injectable clock (12), repository CRUD (12), Today screen behaviors (8), migration idempotency, adapter fallback branch. |
| `39b506f` → `0c2db9b` | (Day 1) native environment unblocked (icons/bundle), DB-failure hard-fail, crash-safe sessions, real habit consistency, Day-1 walkthrough. |

## 2. Native verification — what was proven, and how

- **Production database located and inspected**: `C:\Users\sarth\AppData\Roaming\com.trajectory.app\trajectory.db`. SQLite runs in **WAL mode** — recent writes live in `trajectory.db-wal` until the checkpoint on clean close. (A reader opening only the main file while the app runs sees stale data; that reader limitation briefly looked like lost writes until the checkpoint proved otherwise.)
- **Persistence loop**: task created in the native app → app closed → relaunched → task intact. Confirmed both in the UI and by reading the SQLite file directly.
- **Deep work lifecycle in the native app**: session started (crash-safety row written), rabbit hole captured mid-session without interrupting the timer, pause froze/resume continued, "Log & Stop" produced a `finished` row with `duration_seconds: 148` against a 191-second wall-clock bracket — pause exclusion works exactly as designed — and the task accrued `actual_minutes: 2`.
- **Overload & compression**: a 600-minute task pushed the day to 150% capacity ("Overloaded by 3h 30m"); the compression modal correctly previewed the algorithm's overrun branch (kept both tasks, "-0m freed"). This is spec'd "always preserve momentum" behavior, **recorded as a deliberate product decision (G-34)**, not a bug: changing it would be a spec change for Phase 2.
- **Production build**: `pnpm tauri build` produced `Trajectory_0.1.0_x64-setup.exe` (3.1 MB NSIS installer) and a 12.5 MB release `trajectory.exe`; the release binary was smoke-booted successfully.

## 3. How to use the app today

```bash
pnpm tauri dev      # native desktop app (incremental compile)
pnpm tauri build    # NSIS installer + release exe
pnpm test           # 78 tests against real in-memory SQLite
```

- First launch seeds 4 areas + 4 dual-target habits automatically.
- In a **dev** build, the command palette (Ctrl+K) has **"Load Development Seed Data (Dev)"** — a deterministic demo dataset (LLM-inference / Bayesian-econometrics / synthetic-DAG work structure) that loads only into an empty task list and is clearly marked as demo data.
- Real data lives at `%APPDATA%\com.trajectory.app\trajectory.db` (delete the file for a fresh install; migrations + defaults re-run).

## 4. Honest remaining gaps (deferred deliberately)

- No crash-recovery UI: an interrupted session leaves a truthful `paused` row, but nothing surfaces it on relaunch.
- Inbox tasks are still invisible (no inbox view); deferred tasks have no restore path.
- "Tomorrow objective" persists to the review but isn't surfaced the next morning; primary objective and available minutes remain memory-only.
- Rabbit holes have no list/conversion UI; goals have no repo/UI; actions (subtasks) exist only as schema + repo.
- No runtime Zod validation at repository boundaries; no lint/format tooling; `release.md` still references a nonexistent `pnpm lint`.
- No git remote configured — the whole history is local on `main` until the user provides a remote URL.
- Test suite takes ~1 min wall-clock (jsdom setup dominates).

These are recorded in `.agents/KNOWLEDGE_GRAPH.md` §8–§10 with gotcha IDs, ready to be folded into Phase 2 planning.

## 5. Definition of Done — met

The PLAN → TODAY → EXECUTE → CAPTURE REALITY → COMPLETE/DEFER → REVIEW loop runs natively, and the underlying data survives the process. The app is real, persistent, trustworthy, and usable. Phase 2 (intelligence and synthesis) can begin on this foundation.

## 6. Git state

```text
7609d98 (HEAD -> main) docs: phase 1.5 complete — verification, sync, walkthrough
497ea8f feat: add realistic development seed data
81563a2 fix: reflect accrued session minutes in the task store immediately
48113ae test: strengthen critical execution paths
32091ba chore: ignore local .zcode workspace metadata
b72a3d1 docs: add repo knowledge graph for agent onboarding
0c2db9b docs: phase 1.5 day-1 walkthrough
7cffbbb fix: compute habit consistency from real log history
73796c5 feat: persist deep work sessions for crash safety
39b506f chore: verify native tauri environment
871fc7c docs: preserve MVP walkthrough baseline
1fed554 feat: Trajectory MVP — full execution stack with 7 test suites passing
8b5a609 docs: establish architecture, data model, product spec, and agent rules baseline
```
