## ADDED Requirements

### Requirement: Init-implementer auto-inject skill output omits generated agents block
The `init-implementer` command specification SHALL define auto-inject skill output without generating an `agents:` frontmatter block for newly scaffolded skills.

#### Scenario: Auto-inject skill template generation
- **WHEN** `init-implementer` instructions describe the expected `SKILL.md` output structure for auto-inject skills
- **THEN** the described output excludes any generated `agents:` field
- **AND** the instructions direct implementers to rely on existing agent permission mechanisms instead of agent-list coupling

### Requirement: Existing permission mechanism alignment is preserved
The auto-inject skill output guidance MUST remain compatible with existing `permission.skill` opt-in and skill permission injection behavior.

#### Scenario: Permission model compatibility
- **WHEN** auto-inject skill authoring guidance is consumed by implementers
- **THEN** activation relies on existing agent-side `permission.skill` / project configuration opt-in behavior
- **AND** it does not require introducing new permission constructs
- **AND** it does not require direct per-skill `agents:` lists to activate supported permissions
- **AND** it defines no replacement generated activation step
