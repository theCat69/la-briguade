# la-briguade

An [opencode](https://opencode.ai) plugin that provides a production-grade multi-agent AI engineering pipeline with 14 agents, 17 skills, 12 slash commands, and smart hooks.

:> [!WARNING] This project, at this stage needs [cache-ctrl](https://github.com/theCat69/cache-ctrl) and [playwright-cli](https://github.com/microsoft/playwright-cli) to function properly. It is planned to make them optional in the futur

## Installation

```bash
npx la-briguade install
```

The `install` command adds `"la-briguade@latest"` to the `"plugin"` array in the global opencode config file (`~/.config/opencode/opencode.json`, respecting `$XDG_CONFIG_HOME` on Linux). If the file or its parent directories don't exist, they are created automatically.

To remove the plugin:

```bash
npx la-briguade uninstall
```

The `uninstall` command removes `"la-briguade@latest"` (or the legacy `"la-briguade"` entry) from the same global config file.

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
| architect | subagent | Code structure analyst — maps module boundaries, dependency graphs, and produces architecture blueprints |

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
| `/go-back-to-work` | Resume work after a session failure — loads git log, git diff, git status, and the last context snapshot to restore working context |
| `/unslop` | Run a single AI slop cleanup pass on changed files (interactive) |
| `/unslop-loop` | Run AI slop cleanup in a loop — auto-validates, writes tests, and commits after each cycle |
| `/refactor` | Structured refactoring workflow — architect analysis, critic challenge, user approval, then Orchestrator-led implementation |
| `/local-context-full-gathering` | Parallel full context re-scan batched across multiple local-context-gatherers |
| `/plan-prd` | End-to-end PRD planning workflow: deep requirements interview, architecture, library research, critique, iterative refinement, and PRD file generation |
| `/implement-prd` | Implement a PRD spec file via Orchestrator pipeline with validation, scoped execution, phased approvals, and completion reporting |
| `/just-do-it` | Zero-ceremony implementation workflow — understand intent, gather context, architect a plan, challenge it, refine if needed, implement the full pipeline, and commit |

## Hooks

The plugin registers six built-in hooks that run automatically:

1. **Tool Output Truncator** — Prevents context window bloat by truncating tool outputs exceeding 50K characters. Keeps the first 25K and last 10K characters with a marker showing how many characters were removed. Tool outputs with non-string content (e.g. structured MCP responses) are passed through unchanged.

2. **Edit Error Recovery** — When an `edit` tool call fails with "oldString not found" or "Found multiple matches", appends a hint telling the agent to re-read the file before retrying.

3. **Empty Response Detector** — Monitors `message.updated` events and warns when the assistant produces zero output tokens, catching silent failures early.

4. **Model Section Injector** — At chat time, inspects the active model ID and appends the matching model-family section from the agent body to its system prompt (see [Model-Specific Prompt Sections](#model-specific-prompt-sections) below).

5. **Vendor Prompt Injector** — After the model section, appends the global vendor prompt for the matched model family (loaded from `content/vendor-prompts/`) to every agent system prompt. Unlike model sections, vendor prompts live in separate files and apply uniformly to all agents — no per-agent markup needed. No fallback is applied; if no family matches the active model, nothing is injected.

6. **Skill Access Gate** — Enforces `permission.skill` declarations from agent frontmatter. Uses `chat.params` to track which agent is active per session, then gates every `skill` tool call in `tool.execute.before`: if an agent declares `permission.skill["*"]: "deny"`, only explicitly allow-listed skill names pass through. Session state is cleaned up on `session.deleted` to prevent memory leaks.

## CLI Commands

```bash
la-briguade install     # Register plugin in opencode config
la-briguade uninstall   # Remove plugin from opencode config
la-briguade doctor      # Run diagnostic checks
la-briguade update      # Update to the latest version globally
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
| `variant` | `string` (max 100 chars) | Model variant name (e.g. `"high"` for high reasoning effort on GitHub Copilot Claude models). |
| `permission` | `Record<string, string \| boolean \| number \| Record<string, string \| boolean \| number>>` | Permission overrides merged on top of agent defaults. Top-level values may be scalars or nested objects (e.g. `{ "bash": { "playwright-cli *": "allow" } }`) |
| `tools` | `Record<string, boolean>` | Enable or disable specific tools |
| `log_level` | `"off" \| "error" \| "warn" \| "info" \| "debug"` | Logger verbosity. Applies to both console output and the per-session log file. Default: `"warn"`. The log file is written to `~/.local/share/opencode/log/la-briguade-<timestamp>.log` (respects `$XDG_DATA_HOME`). |

`systemPromptSuffix` is append-only — it is concatenated after the agent's built-in system prompt. When both global and project configs define a suffix for the same agent, both are chained in order (global first, project second).

### Example

```jsonc
{
  "$schema": "https://unpkg.com/la-briguade/schemas/la-briguade.schema.json",
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

All agents, skills, and commands are plain Markdown files with YAML frontmatter. You can add your own without modifying the package by placing files in user content directories. The plugin resolves three layers of content in priority order (lowest to highest):

1. **Built-in** — bundled inside the npm package (`content/` directory)
2. **Global user** — `~/la_briguade/content/{agents,commands,skills,vendor-prompts}/`
3. **Project user** — `<project_root>/content/{agents,commands,skills,vendor-prompts}/`

Files in higher-priority layers override built-in files with the same stem name. All layers are optional — missing directories are silently skipped.

**Skills additionally scan two native opencode paths** (lowest priority, scanned before the la_briguade layers above):

- `~/.config/opencode/skills/` (respects `$XDG_CONFIG_HOME` on Linux; uses `%APPDATA%\opencode\skills` on Windows) — opencode global skills
- `<project_root>/.opencode/skills/` — opencode project-level skills

This means any skill already installed at the opencode level is automatically available to la-briguade agents without any extra configuration.

> **Security / Trust Boundary**
> Content placed in `~/la_briguade/` or project-level `content/` directories can override built-in agents, skills, commands, and vendor prompts.
> Only place files from trusted sources in these override directories.

**Example**: to override the built-in `coder` agent with a custom version, create `~/la_briguade/content/agents/coder.md` (applies globally) or `<project_root>/content/agents/coder.md` (applies to that project only).

Content files have a maximum size of 50,000 characters — files exceeding this limit are skipped with a warning.

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
  skill:
    "*": "deny"
    "typescript": "allow"
    "general-coding": "allow"
---

# Identity
You are a specialized agent that...
```

The optional `permission.skill` block controls which skills the agent may load via the `skill` tool. When `"*": "deny"` is set, only explicitly listed skill names with `"allow"` (or `"ask"`) pass through — all others are blocked at the `tool.execute.before` hook. Omitting `permission.skill` entirely leaves skill access unrestricted.

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

**Supported families** (case-insensitive): `claude`, `gpt`, `gemini`, `grok`. A special `ALL` target is also supported — sections tagged `====== ALL ======` are included for every model regardless of family.

**Matching logic** — the active model ID (e.g. `"github-copilot/claude-sonnet-4-6"`) is matched against each family name as a substring. All segments in document order whose target is `all` or the matched family are joined and appended. Multiple sections with the same target are allowed and concatenated in order.

**Claude fallback** — only used when no family matched **and** the body contains no `ALL` segment. If the model family was recognised but produced no text, or if any `ALL` segment exists, the fallback is suppressed and only the base body is sent.

**`====== ALL ======` example** — to share a section across all models, place it anywhere after the base:

```markdown
====== CLAUDE ======
Reason step-by-step before writing any code.

====== ALL ======
Always include a brief summary of your changes.

====== GPT ======
Use structured output format. Show a plan before code.
```

In this example, a Claude model receives the `CLAUDE` and `ALL` sections; a GPT model receives `GPT` and `ALL`; a Gemini model receives only `ALL`.

**Unknown families** produce a logger warning and are skipped. A maximum of 50 segments per agent body is enforced; excess segments are skipped with a warning.

### Vendor Prompts

**Vendor prompts** are global instructions applied to **all agents** when the active model matches a known family. They live in `content/vendor-prompts/` as plain Markdown files named after the family (`claude.md`, `gpt.md`, `gemini.md`, `grok.md`).

At chat time the vendor prompt is appended after any per-agent model section. No per-agent markup is required — the file's existence is enough. If no family matches the active model, nothing is injected (no fallback).

This is the recommended place for cross-cutting, model-specific instructions that should apply uniformly across all agents (e.g. output formatting preferences, safety reminders, tool-use conventions for a specific provider).

## Requirements

- **Node** >= 22
- **`@opencode-ai/plugin`** ^1.4.0 (peer dependency)

## Architecture

The plugin resolves content from three ordered layers (built-in package, global user `~/la_briguade/`, project `<root>/`) using a last-wins merge by filename stem. All content loaders use `collectFiles()` / `collectDirs()` from `src/utils/content-merge.ts`. No files are copied to your system — agents, skills, and commands are registered in-memory at runtime.

## License

[MIT](LICENSE)
