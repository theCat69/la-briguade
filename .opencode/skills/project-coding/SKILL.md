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

- Use try-catch with `console.warn("[la-briguade] ...")` for non-fatal failures (e.g. missing content dirs, YAML parse errors)
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
Agents, skills, and commands are loaded from `.md` files in `content/{agents,skills,commands}/` at init time. Agent/command identity comes from the filename (`.md` stripped, first char lowercased for agents). Frontmatter YAML provides metadata.

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

### No Classes
Prefer plain functions and type aliases over classes. Stateful configuration lives in the `input` config object passed to `config()`.

## Code Examples

See `.code-examples-for-ai/` for concrete, copy-paste-ready patterns:

- `plugin-registration.md` — Plugin function structure
- `frontmatter-parsing.md` — Safe YAML frontmatter extraction
- `hook-creation.md` — Hook registration and output mutation
- `cli-command.md` — Commander.js command with JSONC editing
- `safe-dir-read.md` — Defensive directory reading with warning
