# AGENTS.md

## About la-briguade

**la-briguade** is an [opencode](https://opencode.ai) plugin that registers a production-grade multi-agent AI engineering pipeline at runtime. It loads agent definitions, skills, and slash commands from Markdown files in the `content/` directory and registers them programmatically via the `@opencode-ai/plugin` API. It also installs output-management hooks (truncation, edit-error recovery, empty-response detection) to keep the AI pipeline reliable.

No files are copied to the host system — everything is registered in-memory at opencode startup. It also installs output-management hooks: truncation, edit-error recovery, empty-response detection, model-family prompt section injection, and vendor prompt injection (global prompts appended per model family from `content/vendor-prompts/`).

---

## Project Guidelines

This file is a high-level overview. The canonical detailed guideline source is:

- `.la_briguade/auto-inject-skills/*/SKILL.md` (authoritative)

Optional mirror (only when explicitly maintained by project workflows):

- `.la_briguade/skills/*/SKILL.md`

Load the relevant canonical skill before starting any task.

| Skill file | Description |
|---|---|
| `.la_briguade/auto-inject-skills/project-coding/SKILL.md` | TypeScript strict ESM conventions, naming, import order, error handling, architecture patterns (plugin registration, frontmatter, JSONC, hooks) |
| `.la_briguade/auto-inject-skills/project-build/SKILL.md` | Build commands (`npm run build/dev/clean`), prerequisites (Node ≥22), release workflow, output structure |
| `.la_briguade/auto-inject-skills/project-test/SKILL.md` | Vitest v4 setup, test file naming, AAA pattern, mocking conventions, coverage requirements |
| `.la_briguade/auto-inject-skills/project-documentation/SKILL.md` | TSDoc standards, README format, changelog format, content file documentation |
| `.la_briguade/auto-inject-skills/project-security/SKILL.md` | YAML safe parsing, path traversal prevention, prototype pollution, dependency hygiene, no-secrets policy |
| `.la_briguade/auto-inject-skills/project-code-examples/SKILL.md` | Index of code pattern examples in `.code-examples-for-ai/` — what exists and how to maintain it |

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
| `skill-embedded-mcp.md` | Declaring local/remote MCP servers in SKILL.md frontmatter, `{env:VAR_NAME}` token resolution, command-injection guard, and non-MCP `permission.bash` declarations, and skill-directed agent opt-in via `agents:` |
| `agent-permissions.md` | Agent `permission.skill` declarations and skill-side `agents:` opt-in pattern |
| `content-override-merge.md` | Priority-based merge of layered content directories — builtin < opencode global < global user < opencode project < project user — using `collectFiles()` / `collectDirs()` |
| `logger-notifier.md` | Logger singleton two-phase init and toast notifier with logger fallback |
| `skill-access-gating.md` | Session-aware skill tool gating using `chat.params`, `tool.execute.before`, and `session.deleted` cleanup |

---

## Architecture Overview

```
src/
  index.ts           ← Plugin entry point — wires config() + hooks
  plugin/
    agents.ts        ← registerAgents(config, agentDirs[]) — merges .md files across builtin + user dirs via collectFiles(); applies user overrides; returns { agentSections, agentSkillPerms }
    commands.ts      ← registerCommands(config, commandDirs[]) — merges .md files across builtin + user dirs via collectFiles()
    skills.ts        ← registerSkills(config, skillRoots[]) — discovers skill subdirs across builtin + user roots via collectDirs(); returns { dirs }
    mcp/
      index.ts       ← barrel re-export
      collect.ts     ← collectSkillMcps() / collectSkillBashPermissions() / collectSkillAgents() — reads mcp:, permission.bash, and agents: from SKILL.md files
      merge.ts       ← mergeSkillMcps() — merges collected MCP entries into config.mcp
      permissions.ts ← injectSkillAgentPermissions() / injectSkillMcpPermissions() / injectSkillBashPermissions() — injects skill opt-in, prefixed MCP, and bash permissions into agents
      types.ts       ← internal MCP type definitions (SkillMcpEntry, SkillMcpMap, SkillMcpIndex, SkillAgentIndex, etc.)
    vendors.ts       ← loadVendorPrompts(vendorDirs[]) — merges vendor prompt .md files across builtin + user dirs via collectFiles(); dirs: builtin → ~/la_briguade/vendor-prompts/ → <root>/.la_briguade/vendor-prompts/
    auto-inject.ts   ← collectAutoInjectSkills(), resolveActiveSkills(), injectAutoInjectSkills() — scans auto-inject-skills dirs for SKILL.md files with detect: frontmatter, activates matching skills per project
  config/
    index.ts         ← resolveConfigBaseDirs(projectDir) — returns { globalDir, projectDir } for ~/la_briguade and project root; resolveOpencodeConfigDir() — returns homedir()/.config/opencode; resolveUserConfig() — loads + merges global and project configs
    loader.ts        ← loadConfig() — JSONC file loading with Zod validation
    merge.ts         ← resolveAgentConfig() and swapOpusModel() — layered config merge and model swap helper
    schema.ts        ← Zod schemas: LaBriguadeConfigSchema, AgentOverrideSchema, configJsonSchema (z.toJSONSchema)
  hooks/
    index.ts         ← createHooks(ctx, agentSections, vendorPrompts, agentSkillPerms) — output truncation, edit error hints, empty response detection, model section injection, vendor prompt injection, skill access gating
  cli/
    index.ts         ← Commander CLI: install / uninstall / doctor / update
  utils/
    content/
      frontmatter.ts   ← YAML frontmatter parser
      read-dir.ts      ← Safe directory reader
      content-merge.ts ← collectFiles(dirs[], ext) and collectDirs(roots[]) — priority-based merge helpers for all content loaders
      load-content.ts  ← loadContentFiles<T>(dirs, ext, parse) — generic warn-and-skip content loader used by all content loaders
      read-content-file.ts ← Shared size-limited markdown reader for content loaders
    prompts/
      model-sections.ts ← parseModelSections(), resolveModelSection() — model-family + ALL-target prompt section support (SectionTarget, ModelSegment, ModelSections)
    runtime/
      logger.ts          ← Process-wide logger singleton: levels off/error/warn/info/debug, log file at ~/.local/share/opencode/log/
      notifier.ts        ← Toast notifier wrapping ctx.client?.tui?.showToast with logger fallback
      cache-ctrl-watch.ts  ← Starts cache-ctrl watch background process once per workspace; non-fatal if CLI absent
    support/
      error-message.ts   ← Shared safe error-message normalization/sanitization helper used by warnings and logging paths
      type-guards.ts     ← isRecord(), isNodeError(), Result<T,E> — shared type guards and utility types
  types/
    plugin.ts        ← Type aliases for @opencode-ai/plugin API

content/
  agents/            ← Agent .md files (YAML frontmatter + system prompt body)
  skills/            ← Skill directories, each with SKILL.md
  auto-inject-skills/ ← Auto-inject skill directories (detect: frontmatter triggers project-level activation)
  commands/          ← Slash command .md files
  vendor-prompts/    ← Global vendor prompt files (claude.md, gpt.md, gemini.md, grok.md) — appended to all agent system prompts at chat time

scripts/
  generate-schema.mjs ← Build-time ESM script: reads dist/config/schema.js (compiled Zod output), wraps it with $id/$schema/$title, and writes schemas/la-briguade.schema.json. Run via `npm run generate-schema`.

schemas/
  la-briguade.schema.json ← Generated JSON Schema for la-briguade.json/la-briguade.jsonc. Published with the package (declared in `files`). Canonical URL: https://unpkg.com/la-briguade/schemas/la-briguade.schema.json

bin/
  la-briguade.js     ← CLI shebang entry → dist/cli/index.js
```

### User Content Override Layout

Users can override or extend built-in agents, commands, skills, and vendor prompts by placing files in the following directories. All directories are optional — missing paths are silently skipped. Priority is **last-wins**:

| Content type | Global user | Project user |
|---|---|---|
| Agents | `~/la_briguade/agents/` | `<root>/.la_briguade/agents/` |
| Commands | `~/la_briguade/commands/` | `<root>/.la_briguade/commands/` |
| Skills | `~/.config/opencode/skills/` or `~/la_briguade/skills/` | `<root>/.opencode/skills/` or `<root>/.la_briguade/skills/` |
| Auto-inject skills | `~/la_briguade/auto-inject-skills/` | `<root>/.la_briguade/auto-inject-skills/` |
| Vendor prompts | `~/la_briguade/vendor-prompts/` | `<root>/.la_briguade/vendor-prompts/` |

**Full priority chain** (builtin → project, last-wins):
`content/` (builtin) < `~/.config/opencode/skills/` (opencode global, skills only) < `~/la_briguade/` (global user) < `<root>/.opencode/skills/` (opencode project, skills only) < `<root>/.la_briguade/` (project user)

---

## Stack

- **Language**: TypeScript 5.8, strict mode, `NodeNext` modules, ES2024 target
- **Runtime**: Node.js ≥ 22
- **Build**: `tsc` → `dist/`
- **Test**: Vitest v4
- **Key deps**: `commander`, `yaml`, `jsonc-parser`, `zod`
- **Peer dep**: `@opencode-ai/plugin ^1.4.0`
