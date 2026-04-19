## Why

Skill descriptions are currently too vague in key areas, which leads to inconsistent usage of skills and unclear expectations during auto-inject prompt composition. The repository recently clarified auto-inject prompt wrapping behavior, but this behavior is not yet reflected as a precise, enforceable documentation capability.

## What Changes

- Define a precise skill-description contract for `SKILL.md` content so each skill communicates scope, intent, and usage boundaries unambiguously.
- Define explicit auto-inject description-line behavior so injected prompt text is predictable when a description is present or absent.
- Require code-example index alignment when new or revised skill-description patterns are introduced.
- Standardize terminology across skill docs and examples around skills, auto-inject skills, descriptions, and code examples.

## Capabilities

### New Capabilities
- `precise-skill-descriptions`: skills and auto-inject skills provide precise, action-oriented descriptions with explicit scope boundaries.
- `auto-inject-skill-description-line`: auto-inject prompt wrapping behavior for optional skill description lines is documented as a required contract.
- `skill-description-code-example-indexing`: `.code-examples-for-ai/` and its index remain aligned when description-related patterns are added or changed.

### Modified Capabilities
- None.

## Impact

- **Affected code/content:** skill documentation in `content/skills/**/SKILL.md`, auto-inject skill guidance in `content/auto-inject-skills/**/SKILL.md`, and code-example index documentation in `.opencode/skills/project-code-examples/SKILL.md` with optional additions in `.code-examples-for-ai/`.
- **Affected systems:** documentation-driven behavior of skill loading and prompt injection workflows.
- **APIs/dependencies:** no external API or dependency changes.
- **Operational impact:** clearer skill intent reduces ambiguity for agents and keeps examples synchronized with documented behavior.
