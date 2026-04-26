---
name: dioxus
description: Dioxus production guidance for component architecture, state boundaries, hooks correctness, and UI rendering performance in Rust apps.
detect:
  content:
    - file: Cargo.toml
      contains: "dioxus ="
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

This skill provides production Dioxus guidance for building composable, performant UI components with correct hook usage and clear state boundaries aligned to official framework practices.

## Scope

- **In scope**: Dioxus component design, RSX rendering patterns, hook usage,
  and UI-focused performance guidance.
- **Out of scope**: backend/service architecture, non-Dioxus Rust frameworks,
  and low-level runtime internals.

## Invariants

- Keep components focused and composable; each component should own one clear UI concern.
- Follow Rules of Hooks strictly (no conditional or reordered hook calls).
- Keep state as local as possible; avoid broad top-level state that triggers unrelated rerenders.
- Prefer immutable data flow through props and explicit event callbacks.
- Optimize only after measurement; avoid premature complexity in RSX/render paths.

## Validation Checklist

- Validate implementation decisions against official docs:
  - https://dioxuslabs.com/learn/0.7/
  - https://dioxuslabs.com/learn/0.7/guides/tips/optimizing/
  - https://dioxuslabs.com/learn/0.7/guides/tips/antipatterns/
- Confirm hook usage remains rule-compliant after refactors.
- Ensure UI updates are scoped to the smallest practical component subtree.
- Run project build/tests and verify no regressions in interactive UI behavior.

## Failure Handling

- If rerender churn increases, stop and narrow state ownership before adding memoization.
- If a hook must become conditional to make code "work", redesign component boundaries instead.
- If props require interior mutability to function, refactor the state model to explicit ownership.

## High-Value Dioxus Practices

- Prefer small, pure view components with explicit props over monolithic pages.
- Keep dynamic RSX regions minimal and stable to reduce unnecessary work.
- Model async UI states explicitly (`idle/loading/success/error`) instead of booleans.
- Use production/release profiling signals before shipping performance-oriented changes.
