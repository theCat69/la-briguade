## ADDED Requirements

### Requirement: OpenSpec prerequisites SHALL be explicitly defined for project setup
The project OpenSpec integration documentation and command contracts SHALL define minimum setup prerequisites, including OpenSpec CLI availability and repository-local `openspec/` directory expectations, before OpenSpec-driven planning or implementation workflows are executed.

#### Scenario: Setup documentation coverage is explicit
- **WHEN** setup prerequisites are documented for OpenSpec-integrated commands
- **THEN** required setup documentation scope is explicit and includes prerequisites, init invocation, and baseline verification steps
- **AND** this documentation scope is consistent across proposal, specs, design, and tasks artifacts

#### Scenario: Preconditions are available
- **WHEN** a user starts an OpenSpec-integrated planning or implementation workflow
- **THEN** the workflow verifies that OpenSpec prerequisites are present before proceeding
- **AND** the workflow uses the repository-local `openspec/` structure as the canonical artifact location

#### Scenario: Preconditions are missing
- **WHEN** required OpenSpec prerequisites are not available
- **THEN** the workflow stops with an actionable setup message
- **AND** it MUST NOT perform partial or destructive setup actions

### Requirement: OpenSpec config initialization MUST be idempotent and non-destructive
The integration SHALL provide a command contract that initializes `<project_root>/openspec/config.yaml` in an idempotent manner.

#### Scenario: Init command surface and ownership are explicit
- **WHEN** the setup contract describes initialization behavior
- **THEN** it names the init command surface as `openspec init`
- **AND** it identifies OpenSpec CLI command behavior as the owning contract

#### Scenario: Init creates required OpenSpec scaffolding
- **WHEN** the initialization command runs in a repository missing OpenSpec setup
- **THEN** required `openspec/` directories needed for OpenSpec artifact workflows are created
- **AND** `<project_root>/openspec/config.yaml` is created when absent

#### Scenario: Config file does not exist
- **WHEN** the initialization command runs and `<project_root>/openspec/config.yaml` is absent
- **THEN** the command creates `openspec/config.yaml` with valid baseline OpenSpec configuration
- **AND** it reports successful initialization

#### Scenario: Baseline config expectation is deterministic
- **WHEN** initialization creates a new OpenSpec config
- **THEN** the resulting setup satisfies a deterministic baseline expectation verifiable via `openspec status --json`
- **AND** setup verification does not depend on undocumented local defaults

#### Scenario: Config file already exists
- **WHEN** the initialization command runs and `<project_root>/openspec/config.yaml` already exists
- **THEN** the command preserves existing configuration content
- **AND** it returns a no-op or already-initialized outcome
- **AND** it MUST NOT overwrite user-managed settings without explicit user confirmation

#### Scenario: Repeated initialization attempts
- **WHEN** the initialization command is invoked multiple times for the same project
- **THEN** the resulting project configuration state remains stable and equivalent after the first successful initialization

### Requirement: Setup behavior SHALL preserve legacy workflow compatibility
OpenSpec setup integration SHALL be additive and compatible with legacy PRD-driven workflows.

#### Scenario: Legacy workflow remains available
- **WHEN** OpenSpec setup is introduced in a project that still uses legacy PRD artifacts
- **THEN** existing legacy workflow entry points remain usable
- **AND** OpenSpec setup does not delete or invalidate legacy planning artifacts
