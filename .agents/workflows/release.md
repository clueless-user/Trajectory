# Workflow — Release & Verification

Checklist before cutting a release or completing major milestones:

1. **Static Analysis & Typecheck**:
   - `pnpm typecheck`
2. **Automated Test Suite**:
   - `pnpm test` (unit, domain, repository tests)
   - Test SQLite migrations from initial to latest.
3. **Application Build**:
   - `pnpm build` (frontend bundle)
   - Tauri desktop compile check
4. **Manual Sanity Pass**:
   - Today screen interaction (capture, complete, compress)
   - Deep work session execution and timer accuracy
   - Rabbit hole instant capture and provenance
   - Habit logging with minimum vs normal targets
   - Daily review submission
5. **Git Safety**:
   - Ensure clean working tree.
   - Tag or checkpoint milestone commit with detailed summary.
