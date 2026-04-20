# skill-description-code-example-indexing Specification

## Purpose
TBD - created by archiving change improve-skill-descriptions. Update Purpose after archive.
## Requirements
### Requirement: Description-related pattern changes SHALL be reflected in code examples index
When a change introduces or updates a skill-description-related pattern, `.opencode/skills/project-code-examples/SKILL.md` SHALL be updated to accurately index the corresponding example entry.

#### Scenario: New description-related pattern is introduced
WHEN maintainers add a new code example for skill-description behavior
THEN the project code-examples index includes a matching entry
AND THEN the entry contains a one-line purpose aligned to the example file.

### Requirement: Existing indexed description patterns SHALL remain accurate
If skill-description behavior is revised, the existing indexed example entry SHALL be updated in the same change so the index and example do not drift.

#### Scenario: Existing description pattern changes
WHEN a behavior update affects a previously indexed description pattern
THEN the related example content is revised
AND THEN the index description is updated to match the revised behavior.

