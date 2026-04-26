---
name: react-native
description: React Native production guidance for mobile architecture, runtime performance, navigation, and platform API boundaries.
detect:
  content:
    - file: package.json
      contains: '"react-native"'
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

- **In scope**: React Native app structure, JS/native boundary decisions, navigation,
  rendering performance, and platform API integration.
- **Out of scope**: generic React fundamentals (covered by the `react` skill),
  non-mobile web concerns, and deep native module implementation details.

## Invariants

- Keep 60fps responsiveness as a primary constraint; avoid long JS-thread work on
  interaction-critical paths.
- Treat JS and native execution boundaries explicitly; move heavy or timing-sensitive
  work off hot render/gesture paths.
- Prefer native-stack navigation patterns and predictable route organization.
- Keep platform-specific behavior explicit (`Platform.select`, `.ios/.android` splits)
  instead of implicit branching spread across components.
- Validate user-facing behavior on both iOS and Android when touching shared mobile
  surfaces.

## Validation Checklist

- Validate implementation choices against official docs:
  - https://reactnative.dev/docs/performance
  - https://reactnative.dev/docs/platform-specific-code
  - https://reactnavigation.org/docs/native-stack-navigator/
- Run required project build/tests and ensure no regressions in startup/navigation flows.
- Check for frame drops and avoid introducing obvious bundle/runtime bloat.
- Verify platform API usage is guarded and deterministic across supported platforms.

## Failure Handling

- If interactions stutter or frame drops appear, stop and profile before adding
  additional abstractions.
- If a change blurs JS/native responsibilities, refactor to make the boundary explicit.
- If navigation behavior diverges across platforms, block release until parity is
  restored or an intentional platform difference is documented.

## High-Value React Native Practices

- Keep screen components lean; move business logic into focused hooks/services.
- Use list virtualization and memoization where large collections are rendered.
- Minimize synchronous work during initial mount and screen transitions.
- Prefer battle-tested platform APIs/libraries over custom bridge-heavy solutions.
