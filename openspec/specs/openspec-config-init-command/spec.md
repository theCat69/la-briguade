# openspec-config-init-command Specification

## Purpose
TBD - created by archiving change add-openspec-config-init-command. Update Purpose after archive.
## Requirements
### Requirement: Initialize repository-local OpenSpec configuration at the current upstream path
The `openspec-config-init-command` slash command SHALL initialize OpenSpec using the upstream initializer `openspec init` and SHALL verify success by confirming that `openspec/config.yaml` exists in the repository-local OpenSpec directory. The command MUST treat `openspec/config.yaml` as the canonical success path.

#### Scenario: Initialize missing repository-local config
WHEN the user runs the command in a repository that does not yet contain `openspec/config.yaml`
THEN the command runs `openspec init`
AND THEN the command reports success only if `openspec/config.yaml` is present afterward.

### Requirement: Repeated initialization SHALL be non-destructive by default
The command SHALL treat repeated initialization as idempotent verification/extend mode and MUST use the non-force path by default. If `openspec/config.yaml` already exists, the command MUST NOT instruct or imply destructive overwrite as the normal path.

#### Scenario: Re-run on an already initialized repository
WHEN the user runs the command and `openspec/config.yaml` already exists
THEN the command uses the default non-force initialization path
AND THEN the command reports the repository as already initialized or verified
AND THEN the command does not require replacement of the existing config.

### Requirement: Repair and override flow SHALL be explicit and user-directed
If initialization or verification fails, the command SHALL present `openspec init --force` as the repair/override path. The command MUST describe `--force` as an explicit repair action and MUST NOT present it as the default path.

#### Scenario: Verification fails after default initialization
WHEN the command cannot verify `openspec/config.yaml` after running the default initializer
THEN the command reports that initialization is incomplete or needs repair
AND THEN the command tells the user to run `openspec init --force` to repair or override the local config.

### Requirement: Command output SHALL gate downstream plan/implement workflows
The command SHALL make OpenSpec setup status explicit before plan or implementation workflows continue. Its user-facing result MUST clearly indicate one of: initialized, verified, or repair required.

#### Scenario: User runs setup before planning
WHEN the user invokes the command as a prerequisite to planning or implementation
THEN the command returns a clear setup status
AND THEN the output tells the user whether they can proceed with plan/implement flows or must repair configuration first.

