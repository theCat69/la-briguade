---
name: project-code-examples
description: Catalog of project code examples — what patterns exist and where to find them in .code-examples-for-ai/
agents:
  - coder
  - reviewer
  - architect
  - builder
---

## Scope

- **In scope**: indexing and maintaining repository code-pattern examples consumed by AI workflows.
- **Out of scope**: introducing production behavior changes unrelated to example coverage.

## Invariants

- Example index **MUST** list each maintained pattern file with a one-line purpose.
- Each example file **MUST** represent one focused pattern.
- New patterns introduced in production code **MUST** be reflected in this index.
- Existing examples **MUST NOT** be silently removed without replacement rationale.
- Example snippets **MUST** stay concise and implementation-aligned.

## Validation Checklist

- Verify `.code-examples-for-ai/` contains the files listed in `## Available Examples`.
- Verify any new coding pattern introduced by the change is documented with one dedicated `.md` example file.
- Verify this index section is updated in the same change when example files are added/renamed/removed.

## Failure Handling

- If pattern coverage is unclear, add or update the nearest matching example before marking task done.
- If an example becomes stale after refactors, update it in the same change that introduced drift.
- If no new pattern was introduced, record that no example update was required.

These examples demonstrate the coding patterns used in this project. Reference them when adding new features to maintain consistency.

## Available Examples

- `plugin-registration.md` — How the main Plugin function merges agents, skills, and commands into the opencode Config
- `frontmatter-parsing.md` — Safe YAML frontmatter parsing from .md files using the `yaml` library
- `hook-creation.md` — Creating tool.execute.after and event hooks with output truncation logic
- `cli-command.md` — Setting up a Commander.js CLI command with JSONC config editing
- `safe-dir-read.md` — Defensive directory reading with try-catch and undefined fallback
- `zod-config-schema.md` — Zod v4 config schema with two-arg `z.record`, security `.refine()` constraints, and `z.toJSONSchema()` export
- `model-sections.md` — Parsing model-family sections from agent body text and injecting them at runtime via `experimental.chat.system.transform`
- `global-prompts-loader.md` — Loading shared global prompt content from a directory, keyed by lowercased filename stem, with per-file error resilience
- `skill-embedded-mcp.md` — Declaring local/remote MCP servers in SKILL.md frontmatter, including `{env:VAR_NAME}` token resolution and command-injection guard, and non-MCP `permission.bash` declarations
- `agent-permissions.md` — Agent permission allow/ask/deny visibility model with `permission.skill` gating and the skill-side `agents:` opt-in counterpart
- `content-override-merge.md` — Priority-based merge of layered content directories — builtin < opencode global < global user < opencode project < project user — using `collectFiles()` / `collectDirs()`
- `load-content-helper.md` — Shared `loadContentFiles()` wrapper that centralizes collectFiles + warn-and-skip parsing
- `logger-notifier.md` — Logger singleton with two-phase init and notifier toast fallback integration
- `skill-access-gating.md` — Session-aware skill tool gating using `chat.params`, `tool.execute.before`, and `session.deleted` cleanup

## Location

`.code-examples-for-ai/`

## Maintenance

This index is maintained by the AI. Developers may add entries manually. One file per pattern.

When a new coding pattern is introduced that is not yet represented here:
1. Create a new `.md` file in `.code-examples-for-ai/` with the pattern name as filename
2. Add an entry to the `## Available Examples` list above
3. Each file must include a `<!-- Pattern: name — description -->` comment at the top followed by a single TypeScript code block with inline annotations
