## ADDED Requirements

### Requirement: Reviewer-family agents conditionally load git-diff skill
Reviewer, security-reviewer, and librarian agent specifications SHALL treat git-diff skill loading as conditional based on whether sufficient diff context is already present in the invoking prompt.

#### Scenario: Diff context already provided
- **WHEN** the invoking prompt already includes sufficient staged/unstaged diff context for review
- **THEN** the agent instructions allow proceeding without loading git-diff skill first

#### Scenario: Diff context not provided
- **WHEN** the invoking prompt does not include sufficient diff context for review
- **THEN** the agent instructions require loading git-diff skill guidance before producing review conclusions

### Requirement: Optional wording preserves fallback safety guidance
The wording update MUST preserve explicit fallback guidance so review quality is not reduced when diff context is absent.

#### Scenario: Fallback instruction presence
- **WHEN** reviewer-family prompts are updated for optional git-diff loading
- **THEN** each prompt still contains explicit fallback instructions for obtaining diff context before continuing
