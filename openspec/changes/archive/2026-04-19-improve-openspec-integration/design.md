## Context

This change formalizes OpenSpec as the primary planning-to-implementation contract for `plan-prd` and `implement-prd`, while preserving compatibility with existing PRD-oriented user behavior. The repository already contains OpenSpec workflow commands and configuration, so the integration work is primarily command/agent contract alignment plus explicit setup and initialization behavior.

## Goals / Non-Goals

**Goals:**
- Define OpenSpec setup prerequisites, documentation coverage, and idempotent initialization behavior for `<project_root>/openspec/config.yaml` plus required `openspec/` directories.
- Align `plan-prd` output to OpenSpec change artifacts (proposal/specs/design/tasks), including deterministic rerun semantics for existing target changes.
- Align `implement-prd` execution to OpenSpec status/apply/task lifecycle with explicit fail-safe stop behavior for invalid selection/status/readiness states.
- Align Planner, feature-designer, and feature-reviewer instructions with OpenSpec artifact lifecycle, split readiness-vs-completion checks, and explicit handoff accept/reject contracts.

**Non-Goals:**
- No destructive replacement or removal of legacy PRD files/workflows.
- No redesign of OpenSpec CLI itself.
- No unrelated plugin runtime refactors outside the command/agent integration scope.

## Decisions

1. **Adopt OpenSpec as primary orchestration contract, not an exclusive contract**
   - Rationale: users need consistent OpenSpec artifacts without breaking current habits.
   - Alternative considered: hard switch that removes legacy PRD paths; rejected as disruptive and non-compatible.

2. **Specify explicit idempotent init behavior for `openspec/config.yaml`**
   - Rationale: predictable setup enables safe repeated use in existing projects.
   - Decision details: initialization is surfaced through `openspec init` (owned by the OpenSpec CLI); it creates missing `openspec/` scaffolding and `openspec/config.yaml` when absent, no-ops when present, and avoids overwrite without explicit user confirmation.
   - Alternative considered: unconditional rewrite of config; rejected as destructive.

3. **Remap command intent rather than command names**
   - Rationale: preserving `plan-prd` and `implement-prd` entry points minimizes adoption friction.
   - Decision details: keep command surfaces but require OpenSpec artifact production/consumption semantics.
   - Alternative considered: introduce entirely new command pair and deprecate old pair immediately; rejected for compatibility concerns.

4. **Make agent alignment artifact-centric and validation-oriented**
   - Rationale: Planner and feature subagents should converge on a single artifact lifecycle and readiness model.
   - Decision details: Planner orchestrates dependency order and handoff eligibility; feature-designer emits OpenSpec-shaped content and MUST reject incomplete planner handoffs; feature-reviewer validates normative requirement quality plus apply-ready tasks formatting and MUST block downstream execution when checks fail.

5. **Separate readiness validation from post-implementation completion checks**
   - Rationale: apply-readiness gates and post-implementation completion are distinct control points and need independent validation.
   - Decision details: readiness is validated before apply execution (`openspec validate`, `openspec status`); completion is validated after implementation via task checkbox transitions and follow-up `openspec status`.

6. **Define deterministic baseline OpenSpec config expectation**
   - Rationale: setup behavior must be testable without ambiguous defaults.
   - Decision details: baseline expectation is that `<project_root>/openspec/config.yaml` exists and is recognized as valid by `openspec status --json`; initialization must produce this state deterministically when absent.

## Risks / Trade-offs

- **[Risk] Partial alignment leaves mixed mental models** → Mitigation: require explicit OpenSpec artifact lifecycle language in all three agents and both commands.
- **[Risk] Users interpret remap as forced migration** → Mitigation: keep compatibility wording explicit and non-destructive in proposal/spec/task scope.
- **[Trade-off] Additional command complexity for compatibility handling** → Mitigation: centralize behavior around status/instructions contracts rather than bespoke branching.

## Migration Plan

1. Update OpenSpec change artifacts for setup, command remapping, and agent alignment capabilities.
2. Implement command and agent markdown contract updates according to tasks.
3. Validate apply-readiness gates (`openspec validate`, `openspec status --change "improve-openspec-integration" --json`) before implementation-phase completion checks.
4. Validate post-implementation completion via task checkboxes and follow-up status checks.
5. During rollout, preserve legacy references while guiding users toward OpenSpec-native artifact flow.

## Open Questions

- Should legacy PRD compatibility messaging include a future deprecation timeline, or remain indefinitely compatibility-first?
