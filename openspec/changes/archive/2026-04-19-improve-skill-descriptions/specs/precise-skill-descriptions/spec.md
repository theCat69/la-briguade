## ADDED Requirements

### Requirement: Skill descriptions SHALL state concrete purpose and scope boundaries
Each skill `SKILL.md` description SHALL communicate the skill's concrete purpose, intended usage scope, and explicit boundary conditions so agents can determine when to use it and when not to use it.

#### Scenario: A skill is loaded for task execution
WHEN an agent reads a skill's description
THEN the description states what the skill is for
AND THEN the description states the expected task scope or domain
AND THEN the description includes at least one boundary condition or non-goal.

### Requirement: Skill descriptions SHALL use repository-aligned terminology
Skill and auto-inject skill descriptions SHALL use repository terminology consistently, including skills, auto-inject skills, descriptions, and code examples where relevant.

#### Scenario: Reviewing multiple skill descriptions
WHEN maintainers compare descriptions across skill files
THEN equivalent concepts use consistent terminology
AND THEN descriptions avoid ambiguous synonyms that obscure repository concepts.
