# Trajectory — DESIGN.md

The design system contract for Trajectory. Any agent generating or critiquing UI for this product MUST follow this file. Values here are extracted from the code (`tailwind.config.js`, `src/index.css`, `src/components/`) — do not invent new tokens; extend via `tailwind.config.js` if something is genuinely missing.

---

## 1. Purpose and scope

Applies to all Trajectory UI: the Tauri 2 desktop app (React 18 + Tailwind, dark-only) — Today/Now console, Planner board, Deep Work cockpit, Habits, Projects hierarchy, Brain Dump, Review (Daily Shutdown + Weekly Review), and global modals/commands.

Out of scope: marketing site, mobile apps (none exist), light theme (none exists).

## 2. Product and user principles

- **Product**: a local-first personal execution OS. Answers "what should I be doing right now?" and "what actually happened?" — planning, execution, and descriptive review.
- **Users**: [NEEDS TEAM INPUT] — primary user is the developer-owner (personal tool); do not design for imaginary personas.
- **Jobs**: capture intent → plan a day → execute in focused sessions → review honestly (daily + weekly).
- **Principles (non-negotiable, from product spec):**
  - **A mirror, not a judge.** Never moralize, never score worth, never guilt.
  - **Descriptive before predictive.** Show what happened with evidence; no advice, ranking, or predictions.
  - **Truthful timing.** Never invent durations or history; show sparse data honestly.
  - **Calm.** Low-chroma dark UI; no alarm colors except true overload states.
- **Voice**: plain, past-tense, non-judgmental. Allowed: "deferred", "completed", "logged", "compressed", "associated with". Forbidden: "procrastination", "failure", "wasted", "lazy", "unproductive", "should", "must".

## 3. Visual hierarchy and layout rules

- Dark-only. Backgrounds layer as: `canvas.base` (app) → `canvas.muted`/`canvas.subtle` (panels) → `canvas.border` hairlines. Never use pure black or pure white.
- Text: `text.primary` for content, `text.secondary` for labels, `text.muted` for timestamps/hints/shortcuts. Nothing below `text.muted` — if it's unreadable, it shouldn't exist.
- One accent per surface role: emerald = success/completion, cyan = focus/execution, amber = caution/in-progress, rose = overload/danger only, purple = capture/tangents, blue = hierarchy/structure. Do not mix accents on one element.
- Density: compact (text-xs/sm base, mono for numbers/timers/dates). This is a tool, not a landing page.
- View containers: `max-w-3xl` default, raising at `2xl` (Today/Habits/Projects → `7xl`, BrainDump → `6xl`, DeepWork → `5xl`, Review → `4xl`). Text-heavy views keep readable measure; boards fill width (`flex-1 min-w-64` Kanban columns).
- Numbers that update live (timers, loads) use `font-mono`. Body prose never does.

## 4. Token and visual-system guidance

Use these tokens only (source: `tailwind.config.js`):

- **Colors**: `canvas.{base #09090b, subtle #121215, muted #18181b, border #27272a, borderStrong #3f3f46}`; `text.{primary #f4f4f5, secondary #a1a1aa, muted #71717a}`; accents `trajectory.{cyan #06b6d4, blue #3b82f6, emerald #10b981, amber #f59e0b, rose #f43f5e, purple #8b5cf6}`; extended zinc `750 #333338`, `850 #1f1f23`. Tailwind default zinc scale is available.
- **Typography**: `font-sans` = Inter (body/UI); `font-mono` = JetBrains Mono (timers, metrics, dates, shortcuts). Sizes: text-xs for labels/metadata, text-sm for body, text-lg/xl for view titles only. No display sizes.
- **Spacing/radius**: Tailwind default scale; cards are `rounded-xl` with `border border-zinc-800` + `bg-zinc-900/50`-style surfaces; inner rows `rounded-lg`.
- **Elevation**: none (no shadows). Depth = background layering + borders. Do not add drop shadows.
- **Motion**: single animation `animate-fadeIn` (150ms ease-out, opacity + 0.98 scale) for modals. No other animation except the Sidebar "ACTIVE" pulse. No transitions > 200ms; no spring/parallax.
- **Iconography**: lucide-react, `w-3.5 h-3.5` (inline) or `w-4 h-4`/`w-5 h-5` (buttons). Icons inherit text color unless marking an accent role.

## 5. Component selection and usage rules

Available (do not re-create these):

- **`Button`** (`common/Button.tsx`): variants `primary|secondary|ghost|danger`; sizes sm/md/lg. ALL padding/typography comes from the Button component — never hand-roll button styles. Icons go in the icon slot (they flex and align); labels `whitespace-nowrap`.
- **`Modal`** (`common/Modal.tsx`): all dialogs. Escape closes; backdrop click does NOT. Wrap content in it rather than building overlays.
- **`Badge`** (+ Importance/Cognitive/Status variants): status labels; `in_progress` renders as "ACTIVE".
- **`ProgressBar` / `DualTargetProgressBar`**: workload and habit targets only. Progress color ladder: zinc → cyan (≥ minimum) → emerald (≥ normal).
- **`Slider`**: 1–10 state metrics (energy/clarity/stress/social battery).
- **Layout**: `Sidebar` (navigation, 7 views) + `Header` (mode chips + quick actions Commands Ctrl+K / Rabbit Hole R / Dump D / New Task N).
- **Modals with existing patterns**: `CommandPaletteModal`, `NewTaskModal` (also edit mode), `RabbitHoleModal` (Ctrl/Cmd+Enter submit), `CompressionModal`.

Rules:
- New UI composes these; if a genuinely new primitive is needed, propose it in this file first.
- Text input styling convention: `bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200` with accent-colored `focus:border-*`.
- Section pattern: `p-5 rounded-xl bg-zinc-900/50 border border-zinc-800` with a mono uppercase tracking-wider header row (icon + label).
- [NEEDS TEAM INPUT] No Storybook/Figma exists. Reference = the live views themselves.

## 6. Interaction states and behavior

- **Keyboard is first-class**: global shortcuts N (new task), R (rabbit hole), D (brain dump), Ctrl/Cmd+K (palette), Space (pause/resume session), Esc (close modal). New interactive surfaces must be reachable without the mouse; the command palette is currently mouse-filter-only — don't copy that limitation into new lists.
- Enter commits inline edits (objective edit, quick capture, interruption note).
- Every destructive or status-changing action settles a running session first (product invariant) — never add a path that strands a session.
- State changes give immediate visible feedback; the store updates optimistically and persists through the store layer (never write to the DB from a component).
- Loading: text + spinner row ("Assembling the week…"), not skeletons or spinners blocking layout.
- [NEEDS TEAM INPUT] Touch targets — desktop-only app; pointer precision assumed.

## 7. Content and microcopy guidance

- Sentence case for body copy; mono uppercase tracking-wider for section labels.
- Numbers in mono with compact duration formatting from `formatMinutes` ("45m", "2h 30m") — never raw minutes in prose.
- Empty states are honest and short, e.g. "No recorded activity this week — nothing to summarize yet.", "Not enough completed tasks yet to estimate planning accuracy." Never render fake insights or placeholder numbers.
- Evidence inline: patterns read "Deep tasks took longer than estimated. (17 tasks)" — statement + observation count.
- Weekly/descriptive copy: association language only ("was associated with"); confidence labels `tentative/supported`; suppress `insufficient` claims entirely.
- No exclamation marks in system copy. No emoji in UI chrome.

## 8. Accessibility requirements

- [NEEDS TEAM INPUT] No formal WCAG target is set. Baseline rules that ARE in force:
  - Text contrast: primary on canvas passes; never place `text.muted` below ~4.5:1 contexts (it's reserved for non-essential metadata).
  - Interactive elements are real `<button>`/`<input>` elements; icon-only buttons need `aria-label` (see WeeklyReview's Previous/Next week buttons).
  - Focus is visible via default browser outline on accent `focus:border-*`; do not `outline-none` without a replacement.
- Motion is minimal (one 150ms fade) — no reduced-motion hazard today; keep it that way.
- Dark-only means no theme toggle; do not introduce color-only meaning (pair color with text/badge).

## 9. Responsive behavior

- Desktop Tauri window; breakpoints are Tailwind defaults with emphasis on `xl`/`2xl` (see caps in §3). Test at: [NEEDS TEAM INPUT] minimum supported window size.
- Boards/grids redistribute: Kanban columns `flex-1 min-w-64`; Habits grid gains `2xl:grid-cols-3`.
- No mobile/tablet layouts exist; do not design bottom bars, hamburger menus, or swipe gestures.

## 10. AI-specific UI patterns

Not applicable yet: Phase 2B is explicitly non-AI (no LLM interpretation, no recommendations). If Phase 3 adds LLM narration over `WeeklyBehaviorFacts`:
- AI output must render inside the same calm review surfaces, carry the same evidence/confidence formatting, and be clearly attributed as generated.
- Never let generated copy use the forbidden moralizing vocabulary (§2), even if the model produces it — filter or template it.
- [NEEDS TEAM INPUT] Streaming/disclosure patterns to be decided in Phase 3.

## 11. Anti-patterns and prohibited choices

- **Any moralizing/productivity-shame copy** (§2 forbidden list) — hard violation.
- **Causal claims** ("caused", "because") from observational data.
- **New color tokens, shadows, gradients beyond the existing `bg-gradient-to-r` headers, or fonts** not in the config.
- **Charts/dashboards** — Weekly Review is deliberately text-based.
- **Notification spam, streak gamification, confetti/celebration effects.**
- Raw SQL or aggregation logic in React components — UI renders facts from the behavior service only.
- Hand-rolled buttons/paddings bypassing `Button`; hand-rolled day math (`toISOString().split("T")[0]`) — use `src/domain/time/date.ts`.
- Re-introducing `recharts`/`clsx`/`tailwind-merge` (removed as dead deps).
- Skeleton loaders, >200ms animations, auto-playing motion.
- Fake precision ("+18.437%") — round to whole percents.

## 12. Canonical design references

- Tokens: `tailwind.config.js` (single source of truth).
- Component sources: `src/components/common/*`, `src/components/layout/*`, `src/components/*Modal.tsx`.
- Best-current-example views: `src/views/TodayView.tsx` (hierarchy + cockpit), `src/views/WeeklyReview.tsx` (calm text report + empty states), `src/views/PlannerView.tsx` (board density).
- Domain copy rules: `docs/SEMANTICS.md` §9 and `docs/PRODUCT.md`.
- Figma/Storybook: none — [NEEDS TEAM INPUT] if ever created, link here.

## 13. Preflight checklist (before generating UI)

- [ ] Only config tokens used; any addition goes through `tailwind.config.js`.
- [ ] Composes existing components (`Button`, `Modal`, `Badge`, `Slider`, `ProgressBar`) instead of re-rolling.
- [ ] Accent color matches the element's role (§3 map).
- [ ] Mono font for all live numbers/timers/dates; sans for prose.
- [ ] Keyboard path exists; Esc/Enter behavior matches §6.
- [ ] Empty/sparse state copy written and honest (§7); no placeholder insights.
- [ ] Copy passes the forbidden-word check (§2) and descriptive/predictive boundary.
- [ ] No new animation beyond `animate-fadeIn`.
- [ ] Data flows store/service → component (no DB access, no aggregation in JSX).

## 14. Final UI QA checklist

- [ ] Renders correctly at default and 2xl window widths; nothing clipped or overlapping.
- [ ] All text ≥ `text-xs` and readable against its background (no `text-zinc-600` on essential info).
- [ ] Every icon-only control has an accessible name; every button has visible hover/active/disabled states.
- [ ] Keyboard-only pass: reach, operate, and escape every new surface.
- [ ] Empty, loading, error, and loaded states all implemented (not just happy path).
- [ ] Live numbers use `formatMinutes`/mono and update without layout shift.
- [ ] Status changes settle running sessions; no path leaves a session stranded.
- [ ] Copy review: no guilt/causality/should-language; evidence counts present on claims.
- [ ] Dark-only integrity: no white flashes, no light-theme assumptions.
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build` pass with the new UI.
