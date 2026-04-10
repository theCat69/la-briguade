# la-briguade

An [opencode](https://opencode.ai) plugin that provides a production-grade multi-agent AI engineering pipeline with 13 agents, 17 skills, 7 slash commands, and smart hooks.

## Installation

```bash
npm install la-briguade
npx la-briguade install
```

The `install` command adds `"la-briguade"` to the `plugins` array in your opencode config file (`opencode.json` or `opencode.jsonc`). If the file doesn't exist, it creates one.

To remove the plugin:

```bash
npx la-briguade uninstall
```

## What's Included

### Agents

| Agent | Mode | Description |
|---|---|---|
| orchestrator | primary | Multi-agent pipeline coordinator — delegates to specialized subagents |
| builder | primary | Single-agent implementation — writes code directly |
| planner | primary | Feature planning orchestrator with designer + reviewer subagents |
| ask | primary | Personal assistant — Q&A with context gathering |
| coder | subagent | Code implementation from context snapshots |
| critic | subagent | Adversarial design challenger |
| reviewer | subagent | Code quality and architecture reviewer |
| security-reviewer | subagent | Security auditor (CVEs, OWASP, Dependabot) |
| librarian | subagent | Documentation keeper |
| local-context-gatherer | subagent | Repository context extractor with caching |
| external-context-gatherer | subagent | External docs/API fetcher with caching |
| feature-designer | subagent | Feature specification writer |
| feature-reviewer | subagent | Feature spec quality gate |

### Skills

| Skill | Description |
|---|---|
| general-coding | Universal coding best practices — naming, testing philosophy, comments, design principles |
| typescript | TypeScript-specific coding guidelines — strict typing, runtime validation, discriminated unions, and error patterns |
| angular | Angular-specific coding guidelines — standalone components, OnPush, signals, reactive forms, and testing conventions |
| java | Java-specific coding guidelines — records, sealed classes, Optional, virtual threads, and stream-based data handling |
| quarkus | Quarkus-specific coding guidelines — reactive I/O, CDI scopes, repository pattern, config mapping, and testing strategy |
| frontend | Frontend verification workflow — HTML semantics, CSS architecture decisions, and browser-based verification |
| playwright-cli | Automate browser interactions, test web pages, and work with Playwright tests |
| git-commit | Git commit guidelines |
| git-diff-review | Compare current branch against upstream to identify changed files for targeted review |
| deep-interview | Socratic requirements gathering with mathematical ambiguity scoring |
| cache-ctrl-caller | How agents decide whether to call context gatherer subagents and control cache invalidation |
| cache-ctrl-local | Detect file changes and manage the local context cache |
| cache-ctrl-external | Check staleness, search, and manage the external context cache |
| unslop | Clean AI-generated code slop in sequential bounded passes scoped to changed files only |
| unslop-coder | Apply a pre-computed unslop findings list — targeted edits only, no scanning |
| unslop-reviewer | Read-only AI slop scanner — emits a structured findings list, never edits files |
| context7 | Fetch up-to-date, version-specific library/framework docs and code examples via the Context7 MCP server |

### Commands

| Command | Description |
|---|---|
| `/init-implementer` | Initialize the implementer agent directory structure and project guidelines |
| `/interview` | Run a deep-interview requirements session with Socratic scored loop |
| `/critic` | Challenge a plan, spec, or current work from first principles |
| `/full-review` | Run a full deep review of the project — code quality, security, and documentation |
| `/unslop` | Run a single AI slop cleanup pass on changed files (interactive) |
| `/unslop-loop` | Run AI slop cleanup in a loop — auto-validates, writes tests, and commits after each cycle |
| `/local-context-full-gathering` | Parallel full context re-scan batched across multiple local-context-gatherers |

## Hooks

The plugin registers five built-in hooks that run automatically:

1. **Tool Output Truncator** — Prevents context window bloat by truncating tool outputs exceeding 50K characters. Keeps the first 25K and last 10K characters with a marker showing how many characters were removed.

2. **Edit Error Recovery** — When an `edit` tool call fails with "oldString not found" or "Found multiple matches", appends a hint telling the agent to re-read the file before retrying.

3. **Empty Response Detector** — Monitors `message.updated` events and warns when the assistant produces zero output tokens, catching silent failures early.

4. **Model Section Injector** — At chat time, inspects the active model ID and appends the matching model-family section from the agent body to its system prompt (see [Model-Specific Prompt Sections](#model-specific-prompt-sections) below).

5. **Vendor Prompt Injector** — After the model section, appends the global vendor prompt for the matched model family (loaded from `content/vendor-prompts/`) to every agent system prompt. Unlike model sections, vendor prompts live in separate files and apply uniformly to all agents — no per-agent markup needed. No fallback is applied; if no family matches the active model, nothing is injected.

## CLI Commands

```bash
la-briguade install     # Register plugin in opencode config
la-briguade uninstall   # Remove plugin from opencode config
la-briguade doctor      # Run diagnostic checks
```

## Configuration

la-briguade supports a layered config system that lets you override agent settings without modifying the package.

### Config file locations

| Scope | Path |
|---|---|
| Global | `~/la_briguade/la-briguade.json` (or `.jsonc`) |
| Project | `<project_root>/la-briguade.json` (or `.jsonc`) |

Both files are optional. When both are present, project values take precedence over global values.

### Merge order (lowest to highest priority)

1. Internal plugin defaults (agent frontmatter in `content/agents/*.md`)
2. Global user config (`~/la_briguade/la-briguade.json`)
3. Project-level config (`<project_root>/la-briguade.json`)

### Supported fields

A top-level `model` field applies to all agents unless overridden per-agent. Per-agent overrides live under the `agents` key:

| Field | Type | Description |
|---|---|---|
| `model` | `string` (max 200 chars) | Model identifier, e.g. `"anthropic/claude-opus-4"`. Only `[A-Za-z0-9_\-./@]` characters allowed. |
| `opus_enabled` | `boolean` | When `false` (the default), any `claude-opus-*` model is automatically swapped to `claude-sonnet-*` at startup. Set to `true` to keep opus models as-is. |
| `systemPromptSuffix` | `string` (max 8000 chars) | Appended to the agent's internal system prompt with `\n\n` |
| `temperature` | `number` (0–2) | Sampling temperature |
| `topP` | `number` (0–1) | Nucleus sampling probability |
| `topK` | `integer` (≥ 0) | Top-K sampling |
| `maxTokens` | `integer` (≥ 1) | Maximum output tokens |
| `reasoningEffort` | `"low" \| "medium" \| "high"` | Reasoning effort hint |
| `permission` | `Record<string, string \| boolean \| number>` | Permission overrides merged on top of agent defaults |
| `tools` | `Record<string, boolean>` | Enable or disable specific tools |

`systemPromptSuffix` is append-only — it is concatenated after the agent's built-in system prompt. When both global and project configs define a suffix for the same agent, both are chained in order (global first, project second).

### Example

```jsonc
{
  "$schema": "https://la-briguade.dev/config.json",
  "model": "openai/gpt-4o",
  "agents": {
    "coder": {
      "model": "anthropic/claude-opus-4",
      "systemPromptSuffix": "Always use PNPM instead of NPM.",
      "temperature": 0.2
    },
    "reviewer": {
      "systemPromptSuffix": "Focus on security vulnerabilities."
    }
  }
}
```

## Adding Custom Content

All agents, skills, and commands are plain Markdown files with YAML frontmatter. You can add your own by placing files in the `content/` directory of the package (or by forking).

### Agent

Create a `.md` file in `content/agents/` with YAML frontmatter and a markdown body (the agent prompt):

```yaml
---
description: "One-line description of what this agent does"
mode: primary          # or subagent
color: "#5865f2"
permission:
  "*": "deny"
  read: "allow"
  edit: "allow"
  bash:
    "*": "deny"
    "git *": "allow"
tools:
  webSearch: true
  bash: false
---

# Identity
You are a specialized agent that...
```

### Skill

Create a directory in `content/skills/{name}/` with a `SKILL.md` file:

```yaml
---
name: my-skill
description: Brief description of what guidelines this skill provides
mcp:
  my-server:
    type: local
    command: ["npx", "-y", "my-mcp-package@latest"]
    timeout: 5000
  remote-server:
    type: remote
    url: https://mcp.example.com/sse
    headers:
      Authorization: "Bearer {env:MY_TOKEN}"
---

# Skill content in markdown...
```

The optional `mcp:` frontmatter field lets a skill declare MCP server configurations. At plugin startup, la-briguade collects all `mcp:` entries from every `SKILL.md` and registers them into `config.mcp`. User config takes precedence — if the user's config already defines an MCP key with the same name, the user's definition wins. Duplicate keys across multiple skill files are resolved by first-seen order (with a warning).

Each MCP entry must specify a `type`:
- **`local`** — runs a local process. `command` is required and must be an argv-style array (e.g. `["npx", "-y", "pkg@latest"]`). Optional: `environment` (key-value env vars), `enabled`, `timeout`.
- **`remote`** — connects to a remote SSE endpoint. `url` is required. Optional: `headers`, `enabled`, `timeout`.

An optional `permission:` block on a local entry declares tool-level permissions for that MCP's tools. Values must be `"allow"`, `"ask"`, or `"deny"`. At startup, la-briguade automatically injects prefixed versions of these permissions into any agent that opts in to the skill (e.g. `"*": "allow"` becomes `"context7_*": "allow"` for the `context7` skill). Agents that already declare a matching key are not overridden.

#### Environment variable tokens

Use `{env:VAR_NAME}` in `command` elements, `environment` values, and `headers` values to inject environment variables at plugin startup. If a variable is not set, la-briguade logs a warning and substitutes an empty string. For `command` elements, if the resolved value contains shell metacharacters (`;`, `|`, `&`, `` ` ``, `<`, `>`, `!`, `$` — note: `/` and `\` are allowed for scoped packages), the element is replaced with an empty string and a warning is logged — this prevents command injection via compromised env vars.

### Command

Create a `.md` file in `content/commands/` with YAML frontmatter:

```yaml
---
description: Brief description of what this command does
---

Command prompt template in markdown. Use $ARGUMENTS for user input.
```

### Model-Specific Prompt Sections

Agent body files support optional **model-family sections** that append extra instructions only when the agent is running on a matching model. The base body (everything before the first section header) is always applied.

**Syntax** — add one or more `====== FAMILY ======` headers anywhere after the base body:

```markdown
---
description: "My coder agent"
mode: subagent
---

You are a coder. Always write tests alongside the implementation.

====== CLAUDE ======
Reason step-by-step before writing any code.

====== GPT ======
Use structured output format. Show a plan before code.

====== GEMINI ======
Use markdown headers for all responses.

====== GROK ======
Be terse. No filler. Code only.
```

**Supported families** (case-insensitive): `claude`, `gpt`, `gemini`, `grok`.

**Matching logic** — the active model ID (e.g. `"github-copilot/claude-sonnet-4-6"`) is matched against each family name as a substring. The first match wins. If no family matches, the `claude` section is used as a fallback. If there is no `claude` section either, only the base body is sent.

**Unknown families** produce a `console.warn` and are skipped.

### Vendor Prompts

**Vendor prompts** are global instructions applied to **all agents** when the active model matches a known family. They live in `content/vendor-prompts/` as plain Markdown files named after the family (`claude.md`, `gpt.md`, `gemini.md`, `grok.md`).

At chat time the vendor prompt is appended after any per-agent model section. No per-agent markup is required — the file's existence is enough. If no family matches the active model, nothing is injected (no fallback).

This is the recommended place for cross-cutting, model-specific instructions that should apply uniformly across all agents (e.g. output formatting preferences, safety reminders, tool-use conventions for a specific provider).

## Requirements

- **Node** >= 22
- **`@opencode-ai/plugin`** ^1.4.0 (peer dependency)

## Architecture

The plugin reads `.md` files from its own `content/` directory at initialization, parses YAML frontmatter, and registers everything programmatically via the opencode plugin config hook. No files are copied to your system — agents, skills, and commands all live inside the npm package and are resolved at runtime.

## License

[MIT](LICENSE)
