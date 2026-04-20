## Why

The current `init-implementer` output guidance can redundantly emit `agents:` entries in auto-inject skill files, creating unnecessary coupling between skills and agent names. Also, reviewer-family agent wording currently treats git-diff skill loading as mandatory, even when invoking prompts already provide sufficient diff context.

## What Changes

- Stop generating `agents:` entries in auto-inject skill output produced by `init-implementer`; activation relies on existing agent-side `permission.skill` / project configuration opt-in, with no replacement generated activation step.
- Update reviewer, security-reviewer, and librarian instructions so git-diff skill loading is optional when diff context is already present in the invoking prompt.
- Preserve fallback behavior: if diff context is missing, agents should still load git-diff guidance before reviewing.

## Capabilities

### New Capabilities
- `auto-inject-skill-output-without-agents-block`: Defines auto-inject skill authoring output requirements that omit generated `agents:` lists.
- `optional-git-diff-loading-when-context-provided`: Defines reviewer-family behavior for conditional git-diff skill loading based on diff context availability.

### Modified Capabilities
- None.

## Impact

- Affected content artifacts: `content/commands/init-implementer.md`, `content/agents/reviewer.md`, `content/agents/security-reviewer.md`, and `content/agents/librarian.md`.
- No runtime API, dependency, or schema changes.
- Reduces redundant configuration output and keeps review prompts context-aware without removing existing safety fallback.
