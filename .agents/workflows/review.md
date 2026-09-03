# Workflow — Review

Systematic checklist to review code before committing or merging:

## 1. Scope Control
- Does this change directly support execution?
- Does it reduce cognitive load rather than adding config?
- Did any unauthorized features sneak in?

## 2. Architectural Integrity
- [ ] No SQL queries inside React components.
- [ ] Business logic is decoupled from React hooks and UI elements.
- [ ] Database access is isolated inside repository modules.
- [ ] Tauri IPC calls are typed and bounded.

## 3. Data & Persistence Safety
- [ ] Historical truth is preserved (replanning does not erase history).
- [ ] All schema modifications have reversible migrations.
- [ ] Deletions use soft delete where historical records matter.
- [ ] Timestamps are handled consistently (UTC internally, local at presentation boundaries).

## 4. Testing & Verification
- [ ] Domain logic has isolated unit tests.
- [ ] Persistence repositories are tested against real SQLite.
- [ ] Critical state transitions have test coverage.
- [ ] All tests pass cleanly without skipping or weak assertions.
- [ ] Build succeeds without warnings or TypeScript errors.
