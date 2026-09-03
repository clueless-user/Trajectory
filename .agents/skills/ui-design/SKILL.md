---
name: ui-design
description: Designs and implements the Trajectory desktop interface. Use when creating, modifying, reviewing, or polishing UI components, layouts, interactions, visual hierarchy, responsive behaviour, accessibility, or interaction patterns.
---

# Trajectory UI Design

You are designing a native desktop application called Trajectory.

Trajectory is a personal operating system for planning, execution, habits, reflection, and eventually behavioural analysis.

The UI must optimize for one thing above all:

> Reduce the cognitive effort required to decide what to do and then do it.

This is NOT a generic productivity SaaS dashboard.

---

# Design Philosophy

## 1. Execution over configuration

The user should be able to open the application and immediately understand:

- What matters today?
- What should I do next?
- How much time do I have?
- What state am I in?
- What happens if I fall behind?

Do not make the user configure a complicated productivity system before receiving value.

---

## 2. Calm, technical, understated

The visual language should feel:

- intelligent
- calm
- slightly irreverent
- technical
- mature
- intentional

Avoid:

- excessive gradients
- excessive rounded cards
- motivational quotes
- gamification spam
- giant colourful KPI dashboards
- "productivity bro" aesthetics
- excessive animations
- unnecessary decorative elements

The interface should feel like a carefully designed desktop tool rather than a web SaaS marketing page.

---

# Visual Hierarchy

Every screen must have a clear primary action.

Do not give equal visual weight to everything.

Use hierarchy roughly as:

1. Current objective
2. Current task
3. Important tasks
4. State/context
5. Secondary information
6. Historical/analytical information

If everything is visually prominent, nothing is prominent.

---

# Today Screen

The Today screen is the application's primary interface.

It should answer:

> "What should I actually do right now?"

Preferred conceptual structure:

```text
TODAY

Primary Objective
────────────────────────────
Finish causal inference proposal

NOW
────────────────────────────
Causal inference
90 minutes
Deep work

UP NEXT
────────────────────────────
Professor email
15 minutes

LATER
────────────────────────────
CUDA
Japanese

STATE
────────────────────────────
Energy       6/10
Clarity      4/10
Stress       5/10

HABITS
────────────────────────────
Exercise     ✓
Meditation   ○
Japanese     ○