## ADDED Requirements

### Requirement: Auto-inject prompt wrapping SHALL handle optional description lines predictably
When an auto-inject skill is appended to an existing prompt, the wrapped block SHALL include a description line only when the skill description is present and non-empty.

#### Scenario: Description is present
WHEN an auto-inject skill has a non-empty description
AND WHEN the system appends wrapped content to an existing prompt
THEN the wrapped block includes the description line directly under the skill heading.

#### Scenario: Description is absent
WHEN an auto-inject skill has no description or an empty description
AND WHEN the system appends wrapped content to an existing prompt
THEN no empty or placeholder description line is emitted in the wrapped block.

### Requirement: Empty existing prompt SHALL use raw body behavior
If the target prompt is empty, auto-inject output SHALL use the skill body directly rather than wrapped append formatting.

#### Scenario: Prompt is initially empty
WHEN the destination prompt content is empty
THEN the auto-inject result is the skill body only
AND THEN wrapper separators and description-line formatting are not added.
