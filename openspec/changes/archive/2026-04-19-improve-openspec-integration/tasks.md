## 1. Define OpenSpec project setup and initialization behavior

- [x] 1.1 Update OpenSpec-integrated command guidance to document required setup prerequisites before planning/implementation execution, including explicit setup documentation scope.
- [x] 1.2 Define init command surface and ownership explicitly as `openspec init` (OpenSpec CLI contract), including expected invocation context and non-destructive behavior guarantees.
- [x] 1.3 Update setup contract to specify init scope: required `openspec/` directory scaffolding plus `<project_root>/openspec/config.yaml` creation when absent.
- [x] 1.4 Define a deterministic baseline setup expectation that is testable: post-init repository state MUST satisfy `openspec status --json` without setup-related errors.
- [x] 1.5 Verify repeated initialization behavior is documented as stable no-op after first successful setup when config already exists.

## 2. Remap `plan-prd` and `implement-prd` toward OpenSpec lifecycle

- [x] 2.1 Update `content/commands/plan-prd.md` so planning output is mapped to OpenSpec artifacts (`proposal.md`, capability `spec.md` files, `design.md`, `tasks.md`).
- [x] 2.2 Define non-destructive rerun behavior for `plan-prd`: when target change already exists, reuse/update by default, require explicit confirmation before creating a different/new change, and never silently overwrite unrelated artifacts.
- [x] 2.3 Update `content/commands/implement-prd.md` so implementation flow is driven by OpenSpec `status`/`instructions apply` context and task checkbox state.
- [x] 2.4 Add explicit `implement-prd` fail-safe behavior: stop with actionable guidance when no change is selected, change status is invalid/blocked, or artifacts are not apply-ready.
- [x] 2.5 Add compatibility-aware fallback wording for legacy PRD-oriented invocation patterns without destructive file replacement.

## 3. Align Planner, feature-designer, and feature-reviewer workflows

- [x] 3.1 Update `content/agents/Planner.md` to orchestrate planning by OpenSpec artifact dependency order and readiness gates, with explicit handoff contract to feature-designer.
- [x] 3.2 Update `content/agents/feature-designer.md` to produce outputs aligned to OpenSpec artifact structures and capability-scoped specs, and to reject/block when Planner handoff is incomplete.
- [x] 3.3 Update `content/agents/feature-reviewer.md` to validate OpenSpec requirement quality, scenario testability, and apply-ready task formatting, and to reject/block implementation handoff when criteria fail.
- [x] 3.4 Verify all three agent workflows preserve compatibility-aware, non-destructive handling of legacy PRD context.

## 4. Validate apply-readiness before implementation completion

- [x] 4.1 Run `openspec validate improve-openspec-integration` and resolve any artifact validation issues.
- [x] 4.2 Run `openspec status --change "improve-openspec-integration" --json` and confirm artifacts are apply-ready prior to implementation completion checks.

## 5. Validate post-implementation completion and negative paths

- [x] 5.1 Verify completion semantics are separate from apply-readiness by confirming task checkbox transitions (`- [ ]` → `- [x]`) after implementation work.
- [x] 5.2 Verify negative-path behavior is documented and scenario-traceable for: missing selected change, invalid/blocked OpenSpec status, and non-apply-ready artifacts.
- [x] 5.3 Re-run `openspec status --change "improve-openspec-integration" --json` to confirm apply-ready state remains intact after artifact revisions.
