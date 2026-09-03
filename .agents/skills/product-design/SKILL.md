---
name: product-design
description: Designs and evaluates Trajectory features according to its execution-first personal operating system philosophy. Use when planning features, changing UX, or making product decisions.
---

# Trajectory Product Design

Trajectory is not a generic todo application.

It is a personal operating system designed to help a cognitively intense user translate long-term goals into immediate executable actions.

## Core Principle

The application should reduce cognitive load rather than create another system that must be managed.

Every feature must answer:

"Does this reduce the effort required to decide or execute what matters?"

If not, question whether the feature belongs.

## Planning Hierarchy

Model:

Life Area
→ Goal
→ Project
→ Task
→ Action

Example:

Career
→ AI Infrastructure
→ LLM Inference Engine
→ KV Cache
→ Benchmark cache layout

The UI should preserve this hierarchy without forcing the user to interact with every level.

## Task Design

Tasks should have:

- title
- project
- importance
- cognitive demand
- estimated duration
- deadline when applicable
- status
- energy requirement

Avoid vague tasks such as:

"Work on career"

Prefer executable tasks such as:

"Implement KV cache benchmark"

## Modes

Support:

- Deep Work
- Admin
- Learning
- Physical
- Shutdown

The user should be able to select a mode and see tasks appropriate to that cognitive state.

## Minimum Viable Actions

Habits should support both:

- normal target
- minimum viable target

Example:

Meditation:
normal = 60 minutes
minimum = 5 minutes

Exercise:
normal = 60 minutes
minimum = 10 minutes

The system should optimize for maintaining trajectory rather than perfect streaks.

## Recovery

When the user is behind schedule, the system should provide a compressed plan.

Never shame the user.

Example:

"You're behind by 2h 15m. Compress today's plan?"

The resulting plan should preserve the highest-leverage tasks and move lower-priority tasks.

## Rabbit Holes

Curiosity should be captured rather than suppressed.

The user must be able to quickly capture a research question without leaving the current task.

Rabbit holes should later become:

- ideas
- research tasks
- projects

## Emotional State

State tracking is intentionally lightweight.

Track:

- energy
- mental clarity
- stress
- social battery

Do not require explanations.

The product should allow:

"I feel bad"

without requiring:

"Why do I feel bad?"

## Reflection

Daily reflection should take less than two minutes.

Ask:

1. What actually got done?
2. What drained me?
3. What gave me energy?
4. What matters tomorrow?

## Product Tone

The interface should feel:

- calm
- intelligent
- slightly irreverent
- technical
- understated

Avoid:
- corporate productivity aesthetics
- gamified children's-app aesthetics
- excessive gradients
- motivational quotes
- achievement spam