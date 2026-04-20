## ADDED Requirements

### Requirement: `plan-prd` SHALL map planning output to OpenSpec change artifacts
The `plan-prd` command contract SHALL produce or update OpenSpec change artifacts under `openspec/changes/<change-name>/` as the primary planning output.

#### Scenario: Planning with sufficient context
- **WHEN** `plan-prd` completes requirements clarification and planning decisions
- **THEN** it produces apply-ready OpenSpec artifacts in schema order (proposal, specs, design, tasks)
- **AND** it uses capability-scoped spec files under `specs/<capability>/spec.md`

#### Scenario: Planning invoked from legacy PRD intent
- **WHEN** a user invokes `plan-prd` with legacy PRD framing
- **THEN** the command guides or maps output into OpenSpec artifacts
- **AND** it preserves compatibility by avoiding destructive replacement of legacy expectations

#### Scenario: Target change already exists on rerun
- **WHEN** `plan-prd` is rerun and `openspec/changes/<change-name>/` already exists
- **THEN** the command reuses and updates that existing change by default
- **AND** it MUST NOT create a second change directory with equivalent intent without explicit user confirmation

#### Scenario: User requests a different change on rerun
- **WHEN** `plan-prd` context indicates creating a new/different change while a likely matching existing change is present
- **THEN** the command requests explicit user confirmation before creating the new change
- **AND** absent confirmation it keeps work scoped to the existing change

### Requirement: `implement-prd` SHALL execute implementation from OpenSpec task state
The `implement-prd` command contract SHALL use OpenSpec change status, apply instructions, and tasks checkbox state as the authoritative implementation workflow.

#### Scenario: OpenSpec change selected
- **WHEN** an OpenSpec change is available for implementation
- **THEN** `implement-prd` reads OpenSpec context artifacts and executes pending tasks in dependency-aware order
- **AND** completed work updates task checkboxes using `- [ ]` to `- [x]` transitions

#### Scenario: Legacy PRD file input is provided
- **WHEN** `implement-prd` is invoked with a legacy PRD file path input
- **THEN** it provides a compatibility path that maps or migrates execution intent to an OpenSpec change context
- **AND** it MUST NOT destructively modify or delete legacy PRD files as part of command execution

#### Scenario: No OpenSpec change is selected
- **WHEN** `implement-prd` starts without an explicit or inferable target change
- **THEN** the command stops without applying implementation work
- **AND** it returns actionable guidance to select a change

#### Scenario: OpenSpec status is invalid or blocked
- **WHEN** target change status is invalid, blocked, or otherwise not actionable
- **THEN** `implement-prd` stops and reports the blocking status details
- **AND** it does not proceed to implementation steps

#### Scenario: Artifacts are not apply-ready
- **WHEN** required artifacts or task readiness checks fail for the target change
- **THEN** `implement-prd` stops before implementation
- **AND** it provides remediation guidance for reaching apply-ready state

### Requirement: Command remapping MUST remain non-destructive and reversible
OpenSpec integration for `plan-prd` and `implement-prd` SHALL be compatibility-aware and non-destructive.

#### Scenario: Existing command users adopt OpenSpec integration
- **WHEN** users already rely on prior `plan-prd` / `implement-prd` workflows
- **THEN** remapped behavior provides clear migration guidance and safe defaults
- **AND** it MUST NOT silently remove user access to existing non-OpenSpec artifacts
