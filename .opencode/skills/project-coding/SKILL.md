---
name: project-coding
description: Project-specific coding guidelines, naming conventions, architecture patterns, and code examples for la-briguade
---

## Code Style

- **TypeScript strict mode** is enforced: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `isolatedModules: true`
- **Target**: ES2024 — **Module**: NodeNext — always use `.js` extension in imports (ESM NodeNext requirement, even when the source file is `.ts`)
- Max line length: 100 characters; 2-space indentation
- Use `import type { ... }` for all type-only imports — reduces compiled output and clarifies intent
- Use `as const` for literal object/array values; use `satisfies` for constrained inference without widening
- `verbatimModuleSyntax` is not enabled in this project — use `import type` manually for type-only imports

## Naming Conventions

| Scope | Convention | Example |
|---|---|---|
| Files | `kebab-case.ts` | `read-dir.ts`, `frontmatter.ts` |
| Functions / variables | `camelCase` | `parseFrontmatter`, `contentDir` |
| Types / interfaces | `PascalCase` | `ParsedFrontmatter`, `ConfigFileResult` |
| Module-level true constants | `SCREAMING_SNAKE_CASE` | `TRUNCATION_THRESHOLD`, `PLUGIN_NAME` |
| Agent/command filenames | lowercase or PascalCase per existing pattern | `coder.md`, `Builder.md` |

## Import Ordering

Blank line between each group:

```typescript
// 1. Node built-ins
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";

// 2. External packages
import { Command } from "commander";
import { parse as parseYaml } from "yaml";
import { modify, applyEdits } from "jsonc-parser";

// 3. Internal project imports
import { readDirSafe } from "./utils/read-dir.js";
import type { HooksResult } from "../types/plugin.js";
```

## Error Handling

- Use try-catch with `logger.warn(message)` (from `src/utils/logger.ts`) for non-fatal failures (e.g. missing content dirs, YAML parse errors)
- Never silently swallow errors — always log with context identifying the source
- Use `Result<T, E>` discriminated union pattern for recoverable errors in library/utility code:
  ```typescript
  type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
  ```
- Fail fast at CLI boundaries: set `process.exitCode = 1` and print actionable user-facing messages
- Always check that `parsed` is a non-null, non-array object before casting to `Record<string, unknown>`

## Patterns & Architecture

### Plugin Registration
The `Plugin` export (`src/index.ts`) is an async function that returns `{ config, ...hooks }`. The `config` callback receives the mutable `input` config object and calls `register*` helpers to merge into it. **Never mutate globals** — only mutate the `input` passed to the `config` callback.

`resolveConfigBaseDirs(projectDir)` (from `src/config/index.ts`) returns `{ globalDir, projectDir }` — the two user content roots (`~/la_briguade/` and the project root). All content loaders receive ordered arrays of dirs (`[builtin, globalUser, projectUser]`) and use `collectFiles()` / `collectDirs()` from `src/utils/content-merge.ts` for priority-based last-wins merging.

```typescript
const LaBriguadePlugin: Plugin = async (ctx) => ({
  config: async (input) => {
    registerAgents(input, contentDir);
    registerCommands(input, contentDir);
    registerSkills(input, contentDir);
  },
  ...createHooks(ctx),
});
```

### Content-Driven Registration
Agents, skills, and commands are loaded from `.md` files resolved across three ordered layers: built-in `content/`, global user `~/la_briguade/content/`, and project-level `<root>/content/`. All loaders call `collectFiles(dirs, '.md')` (for agents/commands/vendors) or `collectDirs(roots)` (for skills) from `src/utils/content-merge.ts`. Later directories in the array override earlier ones by filename stem — this is the user content override mechanism. Agent/command identity comes from the filename (`.md` stripped, first char lowercased for agents). Frontmatter YAML provides metadata.
Agents, commands, and vendor prompts are loaded via `loadContentFiles(dirs, '.md', parseFn)` from `src/utils/load-content.ts` — this centralizes the `collectFiles` → warn-and-skip → parse cycle. Each loader provides its own `parseFn` callback.

### Frontmatter Parsing
Use the `yaml` library's `parse()` with default `schema: "core"` behavior to avoid YAML 1.1 quirks (`on`/`off` → boolean). Always validate the parsed value before casting:

```typescript
const parsed = parseYaml(yamlBlock);
const attributes =
  parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
```

### JSONC Editing
Use `jsonc-parser`'s `modify()` + `applyEdits()` — **never** raw string replacement or `JSON.parse` + `JSON.stringify` on config files (destroys comments). Use `isArrayInsertion: true` when appending to an existing array.

### Hooks
Hooks are registered via `createHooks(ctx)` returning `Partial<HooksResult>`. They are pure transform functions — mutate the `output` object in-place, no return value. Keep hook logic in small, named helper functions (`truncateLargeOutput`, `appendEditErrorHint`, `detectEmptyResponse`).

### Skill-Embedded MCP Servers

Skills can declare MCP servers in `SKILL.md` frontmatter under the `mcp:` key. At startup, `collectSkillMcps()` reads all skill dirs, validates the frontmatter with `SkillMcpMapSchema`, and converts each entry via `toSdkMcpEntry()`.

**`{env:VAR_NAME}` tokens** are supported in `command` elements, `environment` values, and `headers` values. They are resolved via `resolveEnvTokens()` at startup:
- Unset var → `""` + `logger.warn`
- Resolved command element containing `DISALLOWED_COMMAND_CHARS` (`;`, `|`, `&`, `` ` ``, `<`, `>`, `!`, `$`) → `""` + `logger.warn` (injection guard). `/` and `\` are **allowed** (needed for scoped packages like `@scope/pkg`).

`collectSkillMcps()` returns `{ mcpMap, skillMcpIndex }`. The `skillMcpIndex` maps each skill dir basename to its prefixed tool permission map. A skill entry with no `permission:` block defaults to `{ "<id>_*": "allow" }`; a custom `permission:` block pre-prefixes each key (e.g. `"resolve-library-id"` → `"<id>_resolve-library-id"`). `injectSkillMcpPermissions(input, skillMcpIndex)` is called from the `config()` callback and adds missing prefixed entries to agents that opt in to a skill — without overwriting any key the agent already declares.

See `.code-examples-for-ai/skill-embedded-mcp.md` for a full annotated example.

### Non-MCP Skill Permissions — `permission.bash`

SKILL.md files can also declare bash command permissions under `permission.bash`. These are independent of MCP servers and do not require an `mcp:` block.

`collectSkillBashPermissions(skillDirs)` reads `permission.bash` from each SKILL.md and returns a `SkillBashPermIndex` (`Record<skillName, Record<string, string>>`). `injectSkillBashPermissions(input, skillBashPermIndex)` injects missing patterns into `agent.permission.bash` for agents that opt into the skill via `permission.skill`. Injection rules mirror MCP: deny in skill permission → skip; deny value in bash block → skip; existing agent pattern → not overwritten; `permission.bash` is lazily initialised (only created when a non-deny pattern is injected).

Keys in `permission.bash` may contain spaces and glob patterns (e.g. `"playwright-cli *": "allow"`). They are validated with `isSafePermissionSubKey` (blocks prototype pollution names, allows all other characters).

### Skill-Directed Agent Opt-In — `agents:`

SKILL.md files can declare which agents should automatically receive `permission.skill["<skillName>"] = "allow"` at startup. This runs before MCP and bash permission injection, so any MCP tools or bash patterns the skill declares are subsequently injected into those agents as well.

`collectSkillAgents(skillDirs)` reads the optional `agents:` string array from each SKILL.md and returns a `SkillAgentIndex` (`Record<skillName, string[]>`). `injectSkillAgentPermissions(input, skillAgentIndex)` iterates the index and writes the skill's name into each listed agent's `permission.skill` block — without overwriting an existing entry (non-overwrite policy). Unknown agent names (not present in `input.agent`) produce a `logger.warn`. Agent names are validated with `isSafePermissionSubKey` plus a control-character check to guard against log injection.

**Call order in `config()` callback**: `collectSkillAgents` → `injectSkillAgentPermissions` → `collectSkillMcps` → `mergeSkillMcps` → `injectSkillMcpPermissions` → `collectSkillBashPermissions` → `injectSkillBashPermissions`. The agent opt-in step must come first so that agents are already opted-in when MCP/bash injection checks `permission.skill`.

**Design note**: this couples a skill to project-specific agent names; it is intended for first-party project skills, not portable community skills.

### No Classes
Prefer plain functions and type aliases over classes. Stateful configuration lives in the `input` config object passed to `config()`.

## Dependency Guidelines

Declare all runtime libraries in `dependencies`; keep `devDependencies` build/test-only. Before adding a new dependency, verify it ships native ESM or a `"type": "module"`-compatible dual build.

### Production dependencies

| Package | Pinned range | Latest stable | Status | opencode bundled? | Notes |
|---|---|---|---|---|---|
| `commander` | `^14.0.0` | 14.0.3 | Current | Yes | Updated to v14. Review `src/cli/index.ts` for any future API changes before upgrading further. |
| `jsonc-parser` | `^3.3.1` | 3.3.1 | Current | Yes — 3.3.1 exact | Stay at `^3.3.1` |
| `yaml` | `^2.8.3` | 2.8.3 | Current | Indirect | Stay at `^2.8.3` |
| `zod` | `^4.3.6` | 4.3.6 | Current | 4.1.8 (older patch) | Stay at `^4.3.6` — we are ahead of opencode's bundled version |

### Dev dependencies

| Package | Pinned range | Status | Notes |
|---|---|---|---|
| `typescript` | `^5.8.0` | Current (5.x) | TypeScript 6.0 not yet confirmed stable; wait for ecosystem validation |
| `vitest` | `^4.1.4` | Current | Stay at `^4.1.4` |
| `@types/node` | `^22.0.0` | Current (22 LTS) | Keep pinned to Node 22 LTS line — do not follow Node version bumps unless `engines.node` is updated first |
| `@opencode-ai/plugin` | `^1.4.0` | 1.4.x | Track `^1.4.0` — update when new patch verified stable |
| `@opencode-ai/sdk` | `^1.4.0` | 1.4.x | Track `^1.4.0` |

### opencode ecosystem alignment

- opencode 1.4.2 bundles: `zod@4.1.8`, `jsonc-parser@3.3.1`, `commander`, and `yaml` (via gray-matter internally)
- Plugins run in the same Bun runtime as opencode — shared process but no official module-sharing mechanism
- No `peerDependencies` mechanism for opencode's bundled libs — always declare own `dependencies`
- Align major versions with opencode's bundled versions to avoid dual-instance issues in the shared runtime

### Updating deps

Before updating any dep to a major version, verify:
1. It is compatible with Node >=22 and TypeScript strict ESM.
2. It does not conflict with opencode's bundled version of the same library.
3. All tests still pass after the update (`npm test`).

## Code Examples

See `.code-examples-for-ai/` for concrete, copy-paste-ready patterns:

- `plugin-registration.md` — Plugin function structure
- `frontmatter-parsing.md` — Safe YAML frontmatter extraction
- `hook-creation.md` — Hook registration and output mutation
- `cli-command.md` — Commander.js command with JSONC editing
- `safe-dir-read.md` — Defensive directory reading with warning
- `zod-config-schema.md` — Zod v4 config schema with security constraints and JSON Schema export
- `model-sections.md` — Parsing and injecting model-family prompt sections from agent `.md` files
- `load-content-helper.md` — Shared `loadContentFiles()` wrapper that centralizes collectFiles + warn-and-skip parsing
- `global-prompts-loader.md` — Loading shared vendor prompts from a directory, keyed by lowercased filename stem, with per-file error resilience
- `agent-permissions.md` — Agent frontmatter `tools` defaults merged with per-agent user config overrides
- `content-override-merge.md` — Priority-based merge of layered content dirs using `collectFiles()` / `collectDirs()`
- `logger-notifier.md` — File logger singleton with two-phase init and toast notifier fallback

## Zod v4 Notes

This project uses **Zod v4** (`zod ^4.3.6`). Key differences from v3 to be aware of:

- **`z.record` requires two arguments**: `z.record(z.string(), valueSchema)` — the one-arg form is removed in v4.
- **Native JSON Schema**: use `z.toJSONSchema(schema)` — no extra libraries needed (`zod-to-json-schema` is not installed).
- Zod v4 error format is unchanged: access issues via `result.error.issues.length`.
