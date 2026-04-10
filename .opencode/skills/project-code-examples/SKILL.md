---
name: project-code-examples
description: Catalog of project code examples — what patterns exist and where to find them in .code-examples-for-ai/
---

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
- `skill-embedded-mcp.md` — Declaring local/remote MCP servers in SKILL.md frontmatter

## Location

`.code-examples-for-ai/`

## Maintenance

This index is maintained by the AI. Developers may add entries manually. One file per pattern.

When a new coding pattern is introduced that is not yet represented here:
1. Create a new `.md` file in `.code-examples-for-ai/` with the pattern name as filename
2. Add an entry to the `## Available Examples` list above
3. Each file must include a `<!-- Pattern: name — description -->` comment at the top followed by a single TypeScript code block with inline annotations
