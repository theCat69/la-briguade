# AGENTS.md

## About la-briguade

**la-briguade** is an [opencode](https://opencode.ai) plugin that registers a production-grade multi-agent AI engineering pipeline at runtime. It loads agent definitions, skills, and slash commands from Markdown files in the `content/` directory and registers them programmatically via the `@opencode-ai/plugin` API. It also installs output-management hooks (truncation, edit-error recovery, empty-response detection) to keep the AI pipeline reliable.

No files are copied to the host system — everything is registered in-memory at opencode startup. It also installs output-management hooks: truncation, edit-error recovery, empty-response detection, model-family prompt section injection, and vendor prompt injection (global prompts appended per model family from `content/vendor-prompts/`).

---

## Project Guidelines

Detailed, stack-specific guidelines are in `.opencode/skills/`. Load the relevant skill before starting any task.

| Skill file | Description |
|---|---|
| `.opencode/skills/project-coding/SKILL.md` | TypeScript strict ESM conventions, naming, import order, error handling, architecture patterns (plugin registration, frontmatter, JSONC, hooks) |
| `.opencode/skills/project-build/SKILL.md` | Build commands (`npm run build/dev/clean`), prerequisites (Node ≥22), release workflow, output structure |
| `.opencode/skills/project-test/SKILL.md` | Vitest v3 setup, test file naming, AAA pattern, mocking conventions, coverage requirements |
| `.opencode/skills/project-documentation/SKILL.md` | TSDoc standards, README format, changelog format, content file documentation |
| `.opencode/skills/project-security/SKILL.md` | YAML safe parsing, path traversal prevention, prototype pollution, dependency hygiene, no-secrets policy |
| `.opencode/skills/project-code-examples/SKILL.md` | Index of code pattern examples in `.code-examples-for-ai/` — what exists and how to maintain it |

---

## Code Pattern Examples

Concrete, annotated TypeScript snippets live in `.code-examples-for-ai/`. Reference these when adding new features to maintain consistency with the existing codebase:

| File | Pattern |
|---|---|
| `plugin-registration.md` | How the `Plugin` function wires `config()` callbacks and hooks |
| `frontmatter-parsing.md` | Safe YAML frontmatter extraction with validation and error handling |
| `hook-creation.md` | `tool.execute.after` and `event` hooks with output mutation helpers |
| `cli-command.md` | Commander.js command with `jsonc-parser` config editing |
| `safe-dir-read.md` | Defensive `readdirSync` wrapper returning `undefined` on failure |
| `zod-config-schema.md` | Zod v4 config schema with `z.record`, security `.refine()` constraints, and `z.toJSONSchema()` |
| `model-sections.md` | Parsing and injecting model-family prompt sections from agent `.md` files |
| `global-prompts-loader.md` | Loading shared vendor prompts from a directory, keyed by lowercased filename stem, with per-file error resilience |
| `skill-embedded-mcp.md` | Declaring local/remote MCP servers in SKILL.md frontmatter, `{env:VAR_NAME}` token resolution, and command-injection guard |
| `agent-permissions.md` | Agent frontmatter `tools` defaults merged with per-agent user config overrides |

---

## Architecture Overview

```
src/
  index.ts           ← Plugin entry point — wires config() + hooks
  plugin/
    agents.ts        ← Reads content/agents/*.md, registers via input.agent
    commands.ts      ← Reads content/commands/*.md, registers via input.command
    skills.ts        ← Discovers content/skills/ subdirs, registers paths; returns { dirs }
    mcp.ts           ← collectSkillMcps() / mergeSkillMcps() — reads mcp: frontmatter from SKILL.md files, merges into config.mcp; injectSkillMcpPermissions() uses the skillMcpIndex to inject prefixed tool permissions into agents that allow a skill
    vendors.ts       ← loadVendorPrompts() — reads content/vendor-prompts/*.md into a Map
  config/
    index.ts         ← resolveUserConfig() — loads + merges global and project configs
    loader.ts        ← loadConfig() — JSONC file loading with Zod validation
    merge.ts         ← resolveAgentConfig(), applyAgentOverride() — layered merge logic
    schema.ts        ← Zod schemas: LaBriguadeConfigSchema, AgentOverrideSchema, configJsonSchema (z.toJSONSchema)
  hooks/
    index.ts         ← createHooks(ctx, agentSections, vendorPrompts) — output truncation, edit error hints, empty response detection, model section injection, vendor prompt injection
  cli/
    index.ts         ← Commander CLI: install / uninstall / doctor
  utils/
    frontmatter.ts   ← YAML frontmatter parser
    read-dir.ts      ← Safe directory reader
    model-sections.ts ← parseModelSections(), resolveModelSection() — model-family prompt section support
  types/
    plugin.ts        ← Type aliases for @opencode-ai/plugin API

content/
  agents/            ← Agent .md files (YAML frontmatter + system prompt body)
  skills/            ← Skill directories, each with SKILL.md
  commands/          ← Slash command .md files
  vendor-prompts/    ← Global vendor prompt files (claude.md, gpt.md, gemini.md, grok.md) — appended to all agent system prompts at chat time

bin/
  la-briguade.js     ← CLI shebang entry → dist/cli/index.js
```

---

## Stack

- **Language**: TypeScript 5.8, strict mode, `NodeNext` modules, ES2024 target
- **Runtime**: Node.js ≥ 22
- **Build**: `tsc` → `dist/`
- **Test**: Vitest v3
- **Key deps**: `commander`, `yaml`, `jsonc-parser`, `zod`
- **Peer dep**: `@opencode-ai/plugin ^1.4.0`
