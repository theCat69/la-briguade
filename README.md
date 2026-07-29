# la-briguade

An [opencode](https://opencode.ai) plugin that provides a production-grade multi-agent AI engineering pipeline with 15 agents, 22 skills, 17 slash commands, and smart hooks.

:> [!WARNING] This project, at this stage needs [cache-ctrl](https://github.com/theCat69/cache-ctrl) and [playwright-cli](https://github.com/microsoft/playwright-cli) to function properly. It is planned to make them optional in the futur

## Installation

```bash
npx la-briguade install
```

The `install` command adds `"la-briguade@latest"` to the `"plugin"` array in the global opencode config file (`~/.config/opencode/opencode.json`). If the file or its parent directories don't exist, they are created automatically.

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
| planner | primary | Feature planning orchestrator with designer and review subagents |
| ask | primary | Personal assistant — Q&A with context gathering |
| coder | subagent | Code implementation from context snapshots |
| critic | subagent | Adversarial design challenger |
| reviewer | subagent | Code quality and architecture reviewer |
| sidekick-reviewer | primary | Persistent code-quality reviewer used by the `sidekick-reviewer` tool |
| security-reviewer | subagent | Security auditor (CVEs, OWASP, Dependabot) |
| librarian | subagent | Documentation keeper |
| local-context-gatherer | subagent | Repository context extractor with caching |
| external-context-gatherer | subagent | External docs/API fetcher with caching |
| feature-designer | subagent | Feature specification writer |
| feature-reviewer | subagent | Feature spec quality gate |
| architect | subagent | Code structure analyst — maps module boundaries, dependency graphs, and produces architecture blueprints |

### Custom tools

| Tool | Description |
|---|---|
| sidekick-reviewer | Starts or resumes a persistent, read-only code-review session using the `sidekick-reviewer` OpenCode agent. |

Use `sidekick-reviewer` for code-quality reviews instead of creating a `reviewer` subagent. Supply
a `review_prompt`; the tool derives its name as `<calling-session-id>_review`. The tool reuses the
newest matching review session in the current project by default (`new_session: false`). Set
`new_session` to `true` only when starting work unrelated to the previous review; this starts a
fresh, isolated derived session and retains it for later calls from the same calling session. The
legacy `reviewer` agent remains available for
feature-planning workflows.

| Argument | Required | Contract |
|---|---|---|
| `review_prompt` | Yes | The review request, from 1 to 20,000 characters. |
| `new_session` | No | Boolean; defaults to `false`. Set to `true` only to start an unrelated review task. |

### Skills

| Skill | Description |
|---|---|
| general-coding | Apply cross-language engineering baselines for naming, testing, design principles, and error handling across repository work; defer to language/framework-specific skills for stack-specific rules. |
| typescript | Apply strict TypeScript production rules for typing, runtime validation, state/error modeling, and module organization in TypeScript codebases; not intended for non-TypeScript stacks. |
| angular | Apply Angular project conventions for standalone architecture, state/reactivity, routing/forms, and testing in Angular codebases; do not use for non-Angular stacks. |
| java | Apply Java coding conventions for modern language features, concurrency, collections/streams, and error strategy in Java projects; do not use for non-Java implementations. |
| quarkus | Apply Quarkus service conventions for reactive I/O, CDI/resource boundaries, persistence/config patterns, and Quarkus test layering; do not use outside Quarkus codebases. |
| rust | Apply Rust engineering rules for ownership, type modeling, async/concurrency, testing, and unsafe/safety boundaries in Rust code; do not use for non-Rust projects. |
| frontend | Enforce browser-facing frontend standards and verification steps (semantic HTML, CSS architecture, playwright-cli checks) after UI changes; not applicable to backend-only work. |
| playwright-cli | Drive browser UI checks with playwright-cli commands, snapshots, and test/debug workflows; do not use for backend-only or non-browser tasks. |
| git-commit | Stage and create commits using the repository message convention after implementation is complete; do not use for diff analysis or branch review. |
| git-diff-review | Identify upstream branch and changed files with git diff for scoped code review; do not perform commit operations in this skill. |
| deep-interview | Resolve ambiguous implementation requests through scored Socratic clarification; allow explicit forced proceed with documented assumptions. |
| cache-ctrl-caller | How agents decide whether to call context gatherer subagents and control cache invalidation |
| cache-ctrl-local | Detect file changes and manage the local context cache |
| cache-ctrl-external | Check staleness, search, and manage the external context cache |
| unslop | Perform sequential, validated slop-cleanup edits across seven categories in bounded changed-file scope; do not use for read-only scanning. |
| unslop-coder | Apply structured unslop-reviewer findings as targeted in-scope edits, deferring stale, conflicting, or unsafe changes. |
| unslop-reviewer | Run a read-only, pass-ordered slop scan covering abstraction and locally fixable boundary findings; never edit files. |
| context7 | Fetch version-specific external library/framework docs and examples via Context7 MCP when local repo context is insufficient; do not use for repo-local facts. |
| drawio | Draw diagrams and schemas using draw.io. |
| next-devtools | Discover and use Next.js development tools. |
| read-image | Inspect images efficiently; use cwebp only to convert unsupported formats when necessary. |
| serena | Use LSP-backed semantic tools for repository navigation, editing, refactoring, and debugging. |

### Commands

| Command | Description |
|---|---|
| `/init-implementer` | Initialize the implementer agent directory structure and project guidelines |
| `/update-implementer` | Force-refresh implementer setup by reconciling markdown artifacts against current code state as source of truth |
| `/interview` | Run a deep-interview requirements session with Socratic scored loop |
| `/critic` | Challenge a plan, spec, or current work from first principles |
| `/full-review` | Run a full deep review of the project — code quality, security, and documentation |
| `/go-back-to-work` | Resume work after a session failure — loads git state and last context snapshot, then automatically continues execution from where the session left off |
| `/unslop` | Run a single AI slop cleanup pass on changed files (interactive) |
| `/unslop-loop` | Run AI slop cleanup in a loop — auto-validates, writes tests, commits after each cycle, and supports `--reduce` for size-focused cleanup |
| `/refactor` | Structured refactoring workflow — architect analysis, critic challenge, user approval, then Orchestrator-led implementation |
| `/local-context-full-gathering` | Parallel full context re-scan batched across multiple local-context-gatherers |
| `/to-spec` | Turn the current conversation into a spec and publish it to the configured tracker or local Markdown |
| `/to-tickets` | Break a spec, plan, or conversation into approved tracer-bullet tickets with dependency edges |
| `/implement` | Implement approved work from a spec or unblocked ticket using its agreed test seams |
| `/just-do-it` | Zero-ceremony, fully autonomous implementation workflow — understand intent, gather context, architect a plan, challenge it, implement the full pipeline, and commit without interruption |
| `/grilling` | Stress-test a plan, decision, or idea through a decision-tree interview before acting |
| `/handoff` | Create a compact, redacted Markdown handoff for a future agent or session |
| `/learn` | Teach a topic through a focused lesson, with optional persistent artifacts outside the project workspace |

## Hooks

The plugin registers six built-in hooks that run automatically:

1. **Tool Output Truncator** — Prevents context window bloat by truncating tool outputs exceeding 50K characters. Keeps the first 25K and last 10K characters with a marker showing how many characters were removed. Tool outputs with non-string content (e.g. structured MCP responses) are passed through unchanged.

2. **Edit Error Recovery** — When an `edit` tool call fails with "oldString not found" or "Found multiple matches", appends a hint telling the agent to re-read the file before retrying.

3. **Empty Response Detector** — Monitors `message.updated` events and warns when the assistant produces zero output tokens, catching silent failures early.

4. **Model Section Injector** — At chat time, inspects the active model ID and appends the matching model-family section from the agent body to its system prompt (see [Model-Specific Prompt Sections](#model-specific-prompt-sections) below).

5. **Vendor Prompt Injector** — After the model section, appends the global vendor prompt for the matched model family (loaded from the built-in `content/vendor-prompts/` and any user overrides in `~/la_briguade/vendor-prompts/` or `<project_root>/.la_briguade/vendor-prompts/`) to every agent system prompt. Unlike model sections, vendor prompts live in separate files and apply uniformly to all agents — no per-agent markup needed. No fallback is applied; if no family matches the active model, nothing is injected.

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
| Global | `~/.config/la_briguade/la-briguade.json` (or `.jsonc`) |
| Project | `<project_root>/la-briguade.json` (or `.jsonc`) |

Both files are optional. When both are present, project values take precedence over global values.

### Merge order (lowest to highest priority)

1. Internal plugin defaults (agent frontmatter in `content/agents/*.md`)
2. Global user config (`~/.config/la_briguade/la-briguade.json`)
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
| `log_level` | `"off" \| "error" \| "warn" \| "info" \| "debug"` | Logger verbosity. All output goes to the per-session log file only (`~/.local/share/opencode/log/la-briguade-<timestamp>.log`, respects `$XDG_DATA_HOME`). Default: `"warn"`. |
| `auto_inject.max_depth` | `integer` (0–10) | Maximum subdirectory depth scanned for auto-inject file and content detection. `0` (default) checks only the project root. A bare filename such as `package.json` matches at any scanned depth; paths containing a directory separator stay exact. |
| `tracker.provider` | `"github" \| "linear"` | Optional issue tracker used by `/to-spec` and `/to-tickets` to publish specs and tickets. |
| `tracker.project` | `string` | GitHub requires `owner/repository`; Linear accepts a non-empty team or project identifier. |

`systemPromptSuffix` is append-only — it is concatenated after the agent's built-in system prompt. When both global and project configs define a suffix for the same agent, both are chained in order (global first, project second).

Set `auto_inject.max_depth` for monorepos. With a depth of `2`, a skill detection entry of
`package.json` also checks `apps/web/package.json`, while `apps/web/package.json` remains an
exact project-relative path and must still be within the configured depth. The scan skips common
dependency, VCS, and generated-output directories through your Git ignore rules (including
`.gitignore`, `.git/info/exclude`, and global Git excludes) when those paths are untracked.
Tracked files are considered project files even if a later ignore rule matches them. Outside a
Git worktree, it falls back to a bounded scan that skips common generated-output directories. If
Git cannot enumerate a Git worktree, recursive detection fails closed rather than scanning ignored
content.

### Example

```jsonc
{
  "$schema": "https://thecatmaincave.com/la-briguade-dev/la-briguade.schema.json",
  "model": "openai/gpt-4o",
  "auto_inject": {
    "max_depth": 3
  },
  "tracker": {
    "provider": "github",
    "project": "acme/example"
  },
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

### Planning and implementation workflow

Use `/grilling` to settle a change, then `/to-spec` to publish a shared specification and
`/to-tickets` to create dependency-aware tracer-bullet implementation slices. When `tracker` is
configured, the commands publish tracker artifacts and apply `ready-for-agent`; otherwise they use
project-local Markdown under `.scratch/<feature-slug>/`. Use `/implement` only with an agreed spec
or unblocked ticket; it follows the selected artifact's test seams and acceptance criteria.

## Adding Custom Content

All agents, skills, commands, vendor prompts, and auto-inject skills are plain Markdown files with YAML frontmatter. You can add your own without modifying the package by placing files in user content directories. The plugin resolves content in priority order (last-wins):

| Content type | Global user | Project user |
|---|---|---|
| Agents | `~/la_briguade/agents/` | `<project_root>/.la_briguade/agents/` |
| Commands | `~/la_briguade/commands/` | `<project_root>/.la_briguade/commands/` |
| Skills (regular) | `~/.config/opencode/skills/` or `~/la_briguade/skills/` | `<project_root>/.opencode/skills/` or `<project_root>/.la_briguade/skills/` |
| Auto-inject skills | `~/la_briguade/auto-inject-skills/` | `<project_root>/.la_briguade/auto-inject-skills/` |
| Vendor prompts | `~/la_briguade/vendor-prompts/` | `<project_root>/.la_briguade/vendor-prompts/` |

**Priority chain by content type** (lowest → highest, last-wins):

- **Agents / Commands / Vendor prompts**: built-in `content/<type>/` → `~/la_briguade/<type>/` → `<project_root>/.la_briguade/<type>/`
- **Skills (regular)**: built-in `content/skills/` → `~/.config/opencode/skills/` → `~/la_briguade/skills/` → `<project_root>/.opencode/skills/` → `<project_root>/.la_briguade/skills/`
- **Auto-inject skills**: built-in `content/auto-inject-skills/` → `~/la_briguade/auto-inject-skills/` → `<project_root>/.la_briguade/auto-inject-skills/`

> Note: auto-inject discovery now reads only `auto-inject-skills` roots. Legacy regular `skills/` roots are not scanned for auto-inject entries.

Auto-inject prompt insertion uses two modes:

- If an agent already has a non-whitespace system prompt, all injected skills are appended as one wrapped block with
  clear start/end delimiters and a short preface explaining the content is already-loaded auto-injected
  skills. Inside that block, each skill is shown as `#<skillName>` → description line (may be blank)
  → body, preserving skill order.
- If an agent has no existing prompt (or only whitespace), la-briguade starts with the first injected skill body (raw, no
  wrapper). If additional injectable skills exist, they are appended afterward as one wrapped block.

Files in higher-priority layers override built-in files with the same stem name. All directories are optional — missing paths are silently skipped.

Any skill already installed at the opencode level (`~/.config/opencode/skills/` or `<project_root>/.opencode/skills/`) is automatically available to la-briguade agents without any extra configuration.

> **Content Overrides**
> Content placed in `~/la_briguade/` or project-level `.la_briguade/` directories can override built-in agents, skills, commands, and vendor prompts.

**Example**: to override the built-in `coder` agent with a custom version, create `~/la_briguade/agents/coder.md` (applies globally) or `<project_root>/.la_briguade/agents/coder.md` (applies to that project only).

Content files have a maximum size of 50,000 characters — files exceeding this limit are skipped with a warning.

### Agent

Create a `.md` file in `~/la_briguade/agents/` (global) or `<project_root>/.la_briguade/agents/` (project) with YAML frontmatter and a markdown body (the agent prompt):

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

Create a directory in `~/la_briguade/skills/{name}/` (global) or `<project_root>/.la_briguade/skills/{name}/` (project) with a `SKILL.md` file:

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

An optional `permission:` block on a local entry declares tool-level permissions for that MCP's tools. Values must be `"allow"`, `"ask"`, or `"deny"`. At startup, la-briguade automatically injects prefixed versions of these permissions into any agent that opts in to the skill (e.g. `"*": "allow"` becomes `"context7_*": "allow"` for the `context7` skill). The same skill opt-in also injects `permission.external_directory` allow rules for the skill directory itself and its subtree (`<skillDir>` and `<skillDir>/**`) so the agent can read/search files packaged with the skill. Agents that already declare a matching key are not overridden.

#### Skill-directed agent opt-in — `agents:`

A `SKILL.md` can declare which agents should automatically receive `permission.skill["<skillName>"] = "allow"` at startup:

```yaml
---
name: my-skill
description: My skill description
agents:
  - coder
  - reviewer
---
```

When `agents:` is present, each listed agent automatically gets `permission.skill["my-skill"] = "allow"` before downstream skill-derived permission injection runs — so any MCP tools, `permission.bash` patterns, and `permission.external_directory` entries for that skill directory (`<skillDir>` and `<skillDir>/**`) will be injected into those agents as well. Agents that already have an explicit `permission.skill["my-skill"]` entry are not overridden (non-overwrite policy applies). Unknown agent names produce a warning and are skipped. This is intended for first-party project-specific skills; portable community skills should generally not hard-code agent names.

#### Environment variable tokens

Use `{env:VAR_NAME}` in `command` elements, `environment` values, and `headers` values to inject environment variables at plugin startup. If an env var used in an `environment` entry is not set, that entry is omitted from the environment map (debug log only). If an env var used in a `command` element or `headers` value is not set, la-briguade logs a warning and substitutes an empty string. For `command` elements, if the resolved value contains shell metacharacters (`;`, `|`, `&`, `` ` ``, `<`, `>`, `!`, `$` — note: `/` and `\` are allowed for scoped packages), the element is replaced with an empty string and a warning is logged — this prevents command injection via compromised env vars.

### Command

Create a `.md` file in `~/la_briguade/commands/` (global) or `<project_root>/.la_briguade/commands/` (project) with YAML frontmatter:

```yaml
---
description: Brief description of what this command does
---

Command prompt template in markdown. Use $ARGUMENTS for user input.
```

## Requirements

- **Node** >= 22
- **`@opencode-ai/plugin`** ^1.4.0 (peer dependency)

## Architecture

The plugin resolves content from three ordered layers (built-in package, global user `~/la_briguade/`, project `<root>/`) using a last-wins merge by filename stem. Content loaders use `collectFiles()` / `collectDirs()` from `src/utils/content/content-merge.ts`, with related parsing helpers grouped under `src/utils/content/`, runtime services under `src/utils/runtime/`, prompt logic under `src/utils/prompts/`, and shared pure helpers under `src/utils/support/`. No files are copied to your system — agents, skills, and commands are registered in-memory at runtime.

## License

[MIT](LICENSE)
