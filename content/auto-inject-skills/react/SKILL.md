---
name: react
description: React core guidance for purity, state modeling, effects discipline, and predictable component design in React projects.
detect:
  content:
    - file: package.json
      contains: '"react"'
agents:
  - coder
  - reviewer
  - architect
  - feature-designer
  - feature-reviewer
  - planner
  - ask
  - builder
  - orchestrator
---

## Scope

- **In scope**: React component/hook correctness, render purity, state updates,
  effect usage, and compositional design patterns.
- **Out of scope**: Next.js-specific routing/caching/runtime concerns (covered by
  the `nextjs` skill) and framework-agnostic browser styling conventions.

## Invariants

- Components and Hooks **MUST be pure**: no side effects during render.
- Props and state are immutable snapshots; updates must create new values.
- Effects are for synchronizing with external systems only, not for deriving render data.
- State should be minimal and normalized; derive values in render when possible.
- Keys in lists must be stable identifiers, never array index when order can change.

## Validation Checklist

- Validate behavior against official React docs:
  - https://react.dev/reference/rules
  - https://react.dev/reference/rules/components-and-hooks-must-be-pure
  - https://react.dev/learn/synchronizing-with-effects
- Confirm no render-path side effects were introduced.
- Confirm Effects have correct dependencies and cleanup for subscriptions/timers.
- Run project tests and ensure no regression in interactive behavior.

## Failure Handling

- If logic depends on mutating objects/arrays in place, stop and refactor to immutable
  updates before proceeding.
- If an Effect exists only to compute derived UI data, replace it with render-time
  derivation or memoization.
- If hook ordering is conditional, block the change and restore Rules of Hooks
  compliance.

## High-Value React Practices

- Move business rules into testable pure functions, keep components focused on rendering.
- Keep hooks small and single-purpose; split hooks when responsibilities diverge.
- Prefer controlled boundaries for async state (`idle/loading/success/error` unions).
- Memoize only when profiling or clear render hotspots justify it.
