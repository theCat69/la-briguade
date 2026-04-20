## ADDED Requirements

### Requirement: Planner SHALL orchestrate planning around OpenSpec artifact lifecycle
Planner workflow guidance SHALL use OpenSpec change status, artifact dependencies, and readiness gates as the primary orchestration model.

#### Scenario: Planner starts a new feature workflow
- **WHEN** Planner receives a new feature planning request
- **THEN** it establishes or selects an OpenSpec change context
- **AND** it drives planning outputs into proposal, specs, design, and tasks artifacts in dependency order

#### Scenario: Planner handles ambiguous requirements
- **WHEN** requirements are ambiguous or incomplete
- **THEN** Planner resolves ambiguity before producing downstream OpenSpec artifacts
- **AND** it records resulting scope and capability boundaries in proposal/spec artifacts

#### Scenario: Planner handoff to feature-designer is incomplete
- **WHEN** Planner has not produced required upstream artifact context or readiness signals
- **THEN** feature-designer handoff is marked blocked/rejected
- **AND** Planner must complete missing artifacts before downstream design work proceeds

### Requirement: feature-designer SHALL produce OpenSpec-aligned planning outputs
feature-designer workflow guidance SHALL write or refine outputs that are directly consumable by OpenSpec artifact files and apply phase expectations.

#### Scenario: feature-designer generates design-oriented output
- **WHEN** feature-designer is asked to produce planning deliverables
- **THEN** outputs align with OpenSpec artifact structure and naming conventions
- **AND** requirements remain testable and capability-scoped for spec files

#### Scenario: feature-designer handoff to feature-reviewer fails minimum quality gate
- **WHEN** design/spec/task outputs are incomplete, non-normative, or not scenario-testable
- **THEN** feature-designer does not finalize handoff
- **AND** required fixes are returned before review proceeds

### Requirement: feature-reviewer MUST validate OpenSpec readiness and requirement quality
feature-reviewer workflow guidance MUST evaluate artifact completeness, requirement clarity, and apply readiness against OpenSpec conventions.

#### Scenario: Reviewing an OpenSpec-integrated plan
- **WHEN** feature-reviewer reviews planning artifacts
- **THEN** it verifies normative requirement quality and scenario testability in spec files
- **AND** it flags missing dependency artifacts or non-apply-ready task formatting

#### Scenario: Reviewer blocks downstream execution on failed checks
- **WHEN** feature-reviewer detects readiness or quality failures
- **THEN** downstream implementation handoff is rejected/blocked
- **AND** remediation requirements are reported explicitly to Planner/feature-designer

### Requirement: Agent workflow validation SHALL separate readiness from completion
Agent workflow contracts SHALL distinguish pre-implementation apply-readiness validation from post-implementation completion validation.

#### Scenario: Pre-implementation readiness validation
- **WHEN** planning artifacts are considered for apply handoff
- **THEN** agents validate readiness gates before implementation starts
- **AND** they do not treat post-implementation completion checks as readiness substitutes

#### Scenario: Post-implementation completion validation
- **WHEN** implementation work has been performed
- **THEN** agents validate completion using task state transitions and status follow-up
- **AND** completion reporting remains distinct from pre-apply readiness decisions

### Requirement: Agent alignment SHALL preserve compatibility with legacy collaboration patterns
Agent workflow alignment to OpenSpec SHALL be additive and MUST avoid destructive invalidation of legacy collaboration habits.

#### Scenario: Mixed OpenSpec and legacy collaboration context
- **WHEN** users or agents provide legacy PRD-oriented context during aligned workflows
- **THEN** Planner, feature-designer, and feature-reviewer map that context into OpenSpec artifacts where possible
- **AND** they preserve non-destructive behavior toward legacy references
