# la-briguade

An [OpenCode](https://opencode.ai) plugin that adds a ready-to-use AI engineering team to your projects. It includes specialized agents, reusable skills, slash commands, and safeguards for common workflow failures.

Use it to plan work, implement changes, review code and security, and keep documentation aligned—without manually assembling an agent setup for every project.

> [!IMPORTANT]
> la-briguade currently expects [cache-ctrl](https://github.com/theCat69/cache-ctrl) and [playwright-cli](https://github.com/microsoft/playwright-cli) to be available. Making these integrations optional is planned for a future release.

## Installation

```bash
npm install -g la-briguade
npx la-briguade install
```

The first command installs the CLI. The second registers `la-briguade@latest` in OpenCode's global plugin configuration at `~/.config/opencode/opencode.json`. Missing directories and the configuration file are created automatically.

To remove the plugin:

```bash
npx la-briguade uninstall
```

The `uninstall` command removes `"la-briguade@latest"` (or the legacy `"la-briguade"` entry) from the same global config file.

## Getting Started

Open OpenCode in a project after installation. la-briguade registers its agents, skills, and commands in memory; it does not copy files into your project.

Start with the **builder** agent for a focused implementation task, or use `/just-do-it` for an autonomous end-to-end workflow. Run `la-briguade doctor` if installation or configuration needs troubleshooting.

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
| sidekick-reviewer | primary | Persistent code-quality reviewer used by the `sidekick-agent` tool |
| sidekick-security-reviewer | primary | Persistent, read-only security reviewer used by the `sidekick-agent` tool |
| sidekick-librarian | primary | Persistent documentation synchronization agent used by the `sidekick-agent` tool |
| security-reviewer | subagent | Security auditor (CVEs, OWASP, Dependabot) |
| local-context-gatherer | subagent | Repository context extractor with caching |
| external-context-gatherer | subagent | External docs/API fetcher with caching |
| feature-designer | subagent | Feature specification writer |
| feature-reviewer | subagent | Feature spec quality gate |
| architect | subagent | Code structure analyst — maps module boundaries, dependency graphs, and produces architecture blueprints |

### Built-in review tool

| Tool | Description |
|---|---|
| sidekick-agent | Starts or resumes persistent code and security review sessions, or a documentation synchronization session. |

`sidekick-agent` gives agents a persistent workspace for code reviews, security reviews, and documentation updates. It routes each review type to the appropriate specialist and resumes that specialist's prior session when possible.

Documentation synchronization can edit Markdown documentation, prompts, skills, and code examples only; it never edits source code, manifests, schemas, generated files, or other assets.

| Review type | Agent | Session suffix |
|---|---|---|
| `CODE_REVIEW` | `sidekick-reviewer` | `_review` |
| `SECURITY_REVIEW` | `sidekick-security-reviewer` | `_sec-review` |
| `DOCUMENTATION_SYNC` | `sidekick-librarian` | `_doc-sync` |

The tool reuses the newest matching session for the current project by default. Set `new_session` to `true` only for unrelated work.

| Argument | Required | Contract |
|---|---|---|
| `review_prompt` | Yes | The review request, from 1 to 20,000 characters. |
| `review_type` | Yes | `CODE_REVIEW`, `SECURITY_REVIEW`, or `DOCUMENTATION_SYNC`. |
| `new_session` | No | Boolean; defaults to `false`. Set to `true` only to start an unrelated review task. |

### Skills

Skills are focused guidance that agents load when a task calls for them. The project includes 13 auto-injected foundation skills and 12 on-demand skills.

| Skill | Description |
|---|---|
| general-coding | Apply cross-language engineering baselines for naming, testing, design principles, and error handling across repository work; defer to language/framework-specific skills for stack-specific rules. |
| typescript | Apply strict TypeScript production rules for typing, runtime validation, state/error modeling, and module organization in TypeScript codebases; not intended for non-TypeScript stacks. |
| angular | Apply Angular project conventions for standalone architecture, state/reactivity, routing/forms, and testing in Angular codebases; do not use for non-Angular stacks. |
| java | Apply Java coding conventions for modern language features, concurrency, collections/streams, and error strategy in Java projects; do not use for non-Java implementations. |
| quarkus | Apply Quarkus service conventions for reactive I/O, CDI/resource boundaries, persistence/config patterns, and Quarkus test layering; do not use outside Quarkus codebases. |
| rust | Apply Rust engineering rules for ownership, type modeling, async/concurrency, testing, and unsafe/safety boundaries in Rust code; do not use for non-Rust projects. |
| frontend | Enforce browser-facing frontend standards and verification steps (semantic HTML, CSS architecture, playwright-cli checks) after UI changes; not applicable to backend-only work. |
| axum | Apply Axum server and middleware conventions, including layering order and error handling. |
| dioxus | Apply Dioxus component guidance, including hook correctness and rendering performance. |
| flutter | Apply Flutter application architecture and performance best practices. |
| nextjs | Apply Next.js App Router production guidance and use version-accurate local documentation. |
| react | Apply React purity, immutability, and effect synchronization guidance. |
| react-native | Apply React Native performance, navigation, and platform-boundary guidance. |
| playwright-cli | Drive browser UI checks with playwright-cli commands, snapshots, and test/debug workflows; do not use for backend-only or non-browser tasks. |
| git-commit | Stage and create commits using the repository message convention after implementation is complete; do not use for diff analysis or branch review. |
| git-diff-review | Identify upstream branch and changed files with git diff for scoped code review; do not perform commit operations in this skill. |
| deep-interview | Resolve ambiguous implementation requests through scored Socratic clarification; allow explicit forced proceed with documented assumptions. |
| cache-ctrl-caller | How agents decide whether to call context gatherer subagents and control cache invalidation |
| unslop | Perform sequential, validated slop-cleanup edits across seven categories in bounded changed-file scope; do not use for read-only scanning. |
| unslop-coder | Apply structured unslop-reviewer findings as targeted in-scope edits, deferring stale, conflicting, or unsafe changes. |
| unslop-reviewer | Run a read-only, pass-ordered slop scan covering abstraction and locally fixable boundary findings; never edit files. |
| context7 | Fetch version-specific external library/framework docs and examples via Context7 MCP when local repo context is insufficient; do not use for repo-local facts. |
| drawio | Draw diagrams and schemas using draw.io. |
| next-devtools | Discover and use Next.js development tools. |
| read-image | Inspect images efficiently; use cwebp only to convert unsupported formats when necessary. |
| serena | Use LSP-backed semantic tools for repository navigation, editing, refactoring, and debugging. |

### Commands

Slash commands provide guided workflows for common engineering tasks.

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

The plugin runs two safeguards automatically:

1. **Edit Error Recovery** — When an `edit` tool call fails with "oldString not found" or "Found multiple matches", appends a hint telling the agent to re-read the file before retrying.

2. **Empty Response Detector** — Monitors completed `message.updated` events and warns when the assistant produces zero output tokens, catching silent failures early.

## Command-Line Tools

```bash
la-briguade install     # Register plugin in opencode config
la-briguade uninstall   # Remove plugin from opencode config
la-briguade doctor      # Run diagnostic checks
la-briguade update      # Update to the latest version globally
```

## Configuration

You can override agent settings without modifying the package. Global settings apply everywhere; project settings take precedence when both exist.

### Config file locations

| Scope | Path |
|---|---|
| Global | `~/.config/la_briguade/la-briguade.json` (or `.jsonc`) |
| Project | `<project_root>/la-briguade.json` (or `.jsonc`) |

Both files are optional. When both are present, project values take precedence over global values.

### How settings are combined

1. Internal plugin defaults (agent frontmatter in `content/agents/*.md`)
2. Global user config (`~/.config/la_briguade/la-briguade.json`)
3. Project-level config (`<project_root>/la-briguade.json`)

### Available settings

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
  "$schema": "./node_modules/la-briguade/schemas/la-briguade.schema.json",
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
    "sidekick-reviewer": {
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

## Adding Your Own Content

Agents, skills, commands, and auto-inject skills are Markdown files with YAML frontmatter. Add your own without modifying the package by placing files in the directories below. When files share the same name, the later location wins.

| Content type | Global user | Project user |
|---|---|---|
| Agents | `~/la_briguade/agents/` | `<project_root>/.la_briguade/agents/` |
| Commands | `~/la_briguade/commands/` | `<project_root>/.la_briguade/commands/` |
| Skills (regular) | `~/.config/opencode/skills/` or `~/la_briguade/skills/` | `<project_root>/.opencode/skills/` or `<project_root>/.la_briguade/skills/` |
| Auto-inject skills | `~/la_briguade/auto-inject-skills/` | `<project_root>/.la_briguade/auto-inject-skills/` |

**Priority order** (lowest → highest):

- **Agents / Commands**: built-in `content/<type>/` → `~/la_briguade/<type>/` → `<project_root>/.la_briguade/<type>/`
- **Skills (regular)**: built-in `content/skills/` → `~/.config/opencode/skills/` → `~/la_briguade/skills/` → `<project_root>/.opencode/skills/` → `<project_root>/.la_briguade/skills/`
- **Auto-inject skills**: built-in `content/auto-inject-skills/` → `~/la_briguade/auto-inject-skills/` → `<project_root>/.la_briguade/auto-inject-skills/`

> Auto-inject discovery reads only `auto-inject-skills` directories. Regular `skills/` directories are not scanned for auto-inject entries.

Auto-inject prompt insertion uses two modes:

- If an agent already has a non-whitespace system prompt, all injected skills are appended as one wrapped block with
  clear start/end delimiters and a short preface explaining the content is already-loaded auto-injected
  skills. Inside that block, each skill is shown as `#<skillName>` → description line (may be blank)
  → body, preserving skill order.
- If an agent has no existing prompt (or only whitespace), la-briguade starts with the first injected skill body (raw, no
  wrapper). If additional injectable skills exist, they are appended afterward as one wrapped block.

Files in higher-priority layers override built-in files with the same stem name. All directories are optional — missing paths are silently skipped.

Skills already installed for OpenCode in `~/.config/opencode/skills/` or `<project_root>/.opencode/skills/` are available to la-briguade agents automatically.

> **Content Overrides**
> Content placed in `~/la_briguade/` or project-level `.la_briguade/` directories can override built-in agents, skills, and commands.

**Example**: to override the built-in `coder` agent with a custom version, create `~/la_briguade/agents/coder.md` (applies globally) or `<project_root>/.la_briguade/agents/coder.md` (applies to that project only).

Content files can contain up to 50,000 characters. Larger files are skipped with a warning.

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
  - coder
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

## How It Works

At startup, la-briguade combines its built-in content with your global and project-specific customizations. Project content overrides global content, and global content overrides the built-in defaults. Nothing is copied into your project: agents, skills, and commands are registered in memory when OpenCode starts.

## License

[MIT](LICENSE)
