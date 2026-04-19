## 1. Add the OpenSpec config init command
- [ ] 1.1 Identify the existing workflow command files that govern OpenSpec planning and implementation guidance.
- [ ] 1.2 Create a new command in `content/commands/` for initializing OpenSpec config in the current repository only.
- [ ] 1.3 Define command guidance to run `openspec init` and verify that `openspec/config.yaml` exists before reporting success.
- [ ] 1.4 Specify default non-destructive behavior: if `openspec/config.yaml` already exists, instruct the command to stop without overwriting and report the repo as already initialized.
- [ ] 1.5 Specify the explicit repair path: only use `openspec init --force` when the user requests repair or reinitialization.

## 2. Gate downstream workflows on initialization state
- [ ] 2.1 Update `plan-prd` guidance so it checks for `openspec/config.yaml` before proceeding with plan-generation steps.
- [ ] 2.2 Add plan workflow guidance that directs users to the new init command when OpenSpec is not initialized, rather than auto-initializing.
- [ ] 2.3 Update `implement-prd` guidance so it checks for `openspec/config.yaml` before proceeding with implementation workflow steps.
- [ ] 2.4 Add implementation workflow guidance that blocks progress and points to the new init command when initialization is missing.
- [ ] 2.5 Ensure both downstream workflows describe initialization as a readiness gate, not a side effect they perform automatically.

## 3. Align related documentation and command text
- [ ] 3.1 Review adjacent command or workflow content for any existing assumptions that OpenSpec init happens implicitly.
- [ ] 3.2 Update affected guidance text to consistently describe current-repo scope, idempotent default behavior, and explicit `--force` repair usage.
- [ ] 3.3 Confirm the new command and updated workflow guidance use consistent terminology for initialization, verification, and repair.

## 4. Validate behavior and handoff safety
- [ ] 4.1 Verify the new command content clearly distinguishes success, already-initialized, and repair-required outcomes.
- [ ] 4.2 Verify `plan-prd` and `implement-prd` both block when `openspec/config.yaml` is absent and redirect to the init command.
- [ ] 4.3 Verify no command guidance instructs automatic destructive reinitialization by default.
- [ ] 4.4 Verify the documented repair path requires explicit `openspec init --force`.
- [ ] 4.5 Perform a final content review to ensure tasks remain scoped to command/guidance updates only and do not introduce auto-init behavior.
