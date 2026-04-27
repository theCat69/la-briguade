---
name: flutter
description: Flutter mobile production guidance for widget performance, state boundaries, architecture layering, and profiling practices.
detect:
  content:
    - file: pubspec.yaml
      contains: "flutter:"
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

- **In scope**: Flutter mobile UI performance, widget tree design, state locality,
  and architecture boundaries between presentation/domain/data.
- **Out of scope**: platform-specific native code internals and non-Flutter mobile stacks.

## Invariants

- Keep `build()` cheap and deterministic; split large widgets into focused subwidgets.
- Localize state updates to the smallest subtree that needs repainting.
- Separate UI, domain logic, and data access into clear layers.
- Prefer immutable models and explicit state transitions for predictable rendering.
- Validate performance decisions with tooling (DevTools/profile mode), not assumptions.

## Validation Checklist

- Use official guidance for implementation decisions:
  - https://docs.flutter.dev/perf/best-practices
  - https://docs.flutter.dev/app-architecture/recommendations
- Run formatting/lints/tests required by the project and resolve warnings.
- Profile key flows in DevTools when touching render-heavy screens.
- Verify no jank regressions on critical navigation or list interactions.

## Failure Handling

- If frame drops appear after a change, stop and identify repaint/rebuild hotspots
  before adding complexity.
- If state logic leaks across layers, refactor to restore clear presentation/domain/data
  boundaries.
- If architecture trade-offs are uncertain, choose the simplest layered option and
  document the decision.

## High-Value Flutter Practices

- Use `const` constructors/widgets whenever possible to reduce rebuild cost.
- Avoid broad `setState` calls at page roots; isolate updates in leaf widgets.
- Keep async side effects out of widgets when feasible; delegate to controllers/notifiers.
- Prefer composition over deep inheritance for reusable UI behavior.
