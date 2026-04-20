## Why

la-briguade already includes OpenSpec primitives, but the current `plan-prd` and `implement-prd` command flow still centers a parallel PRD workflow. This creates duplication and weakens consistency across planning, implementation, and review stages.

## What Changes

- Define OpenSpec-first project setup prerequisites, baseline config expectations, and explicit setup-documentation coverage for compatibility-aware adoption.
- Remap `plan-prd` to produce OpenSpec change artifacts (proposal/specs/design/tasks), including deterministic rerun behavior when a target change already exists.
- Remap `implement-prd` to execute from OpenSpec change tasks and artifact context, with explicit fail-safe stop conditions for non-apply-ready states.
- Add an explicit initialization command contract (`openspec init`) that ensures required `openspec/` directory scaffolding and initializes `<project_root>/openspec/config.yaml` idempotently and non-destructively.
- Align Planner, feature-designer, and feature-reviewer workflow contracts to OpenSpec artifacts with explicit handoff acceptance/rejection gates.

## Capabilities

### New Capabilities
- `openspec-project-setup`: OpenSpec prerequisites and idempotent project configuration initialization behavior.
- `openspec-prd-command-integration`: Compatibility-aware remapping of `plan-prd` and `implement-prd` onto OpenSpec artifact lifecycle.
- `openspec-agent-workflow-alignment`: Planner and feature subagent workflow alignment to OpenSpec artifacts and readiness states.

### Modified Capabilities
- None.

## Impact

- Affected content and workflow contracts: `content/commands/plan-prd.md`, `content/commands/implement-prd.md`, `content/agents/Planner.md`, `content/agents/feature-designer.md`, and `content/agents/feature-reviewer.md`.
- Setup/usage documentation expectations are made explicit in command contracts and validated through scenario-oriented task checks.
- Introduces no destructive migration requirement for existing PRD-driven usage; behavior remains compatibility-aware and additive.
- No mandatory runtime dependency or schema replacement is required for initial adoption.
