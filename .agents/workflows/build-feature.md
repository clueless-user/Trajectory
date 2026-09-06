# Workflow — Build Feature

Follow this workflow for every new feature or modification:

```text
Explore → Plan → Implement → Verify → Review
```

## 1. Explore
- Understand the existing system, domain contracts, and database schema before changing them.
- Check relevant skills in `.agents/skills/` (`product-design`, `tauri-engineering`, `database`, `ui-design`, `testing`).
- Re-read `project.md`.

## 2. Plan
- Identify:
  - Affected files
  - Domain changes
  - DB schema & migration requirements
  - UI changes
  - Native Tauri boundary changes
  - Testing requirements & test cases
  - Failure paths and edge cases
- Keep changes minimal, coherent, and reversible.

## 3. Implement
- Make the smallest coherent change.
- Never put raw SQL inside React components.
- Keep business logic isolated in domain services.
- Never write destructive migrations.

## 4. Verify
- Run TypeScript compiler: `pnpm typecheck`.
- Run unit and integration tests: `pnpm test`.
- Run production build: `pnpm build`.
- Manually verify UI / native functionality in the desktop app.

## 5. Review
- Inspect `git diff`.
- Ensure no accidental scope creep.
- Create a clear, descriptive Git commit.
