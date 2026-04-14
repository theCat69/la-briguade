# Skill Frontmatter Capabilities

SKILL.md files support optional frontmatter fields that let a skill bring its own tooling and permissions with it at startup. No user configuration is required beyond installing the skill — la-briguade wires everything automatically.

## MCP Servers — `mcp:`

Declare one or more MCP servers under the `mcp:` key:

```yaml
---
name: my-skill
description: My skill
mcp:
  playwright:
    type: local
    command: ["npx", "-y", "@playwright/mcp@latest"]
    environment:
      PLAYWRIGHT_BROWSERS_PATH: "0"
    timeout: 5000

  context7:
    type: local
    permission:
      "*": allow
      "resolve-library-id": allow
    command: ["npx", "-y", "@upstash/context7-mcp@2.1.7", "--api-key", "{env:CONTEXT7_API_KEY}"]

  docs:
    type: remote
    url: https://mcp.example.com/sse
    headers:
      Authorization: "Bearer {env:MY_DOCS_TOKEN}"
    timeout: 4000
---
```

At plugin startup, `collectSkillMcps()` reads every SKILL.md, validates the `mcp:` block, and registers each entry into `config.mcp`. User config wins — if the user already defines a key with the same name, the user's definition is kept. Duplicate keys across multiple skill files are resolved first-seen-wins (with a warning).

Each entry must have a `type`:
- **`local`** — runs a local subprocess. `command` is required and must be a string argv array. Optional: `environment`, `enabled`, `timeout`, `permission`.
- **`remote`** — connects to a remote SSE endpoint. `url` is required. Optional: `headers`, `enabled`, `timeout`, `permission`.

### MCP tool permission injection

An optional `permission:` block on a local or remote entry declares tool-level permissions. At startup, la-briguade automatically injects prefixed versions into agents that opt in to the skill:

- No `permission:` block → default entry `{ "<id>_*": "allow" }` is used.
- Custom block → each key is pre-prefixed (`"*"` → `"<id>_*"`, `"resolve-library-id"` → `"<id>_resolve-library-id"`).

Agents that already have a matching permission key are never overridden.

### `{env:VAR_NAME}` token resolution

Use `{env:VAR_NAME}` in `command` elements, `environment` values, and `headers` values to inject environment variables at startup. Behaviour:

- Unset variable in `environment` value → entry omitted + `logger.debug`.
- Unset variable in `command`/`headers` value → empty string + `logger.warn`.
- Resolved `command` element that contains shell metacharacters (`;`, `|`, `&`, `` ` ``, `<`, `>`, `!`, `$`) → replaced with `""` + `logger.warn`. This prevents command injection via a compromised env var. `/` and `\` are **allowed** (needed for scoped packages like `@scope/pkg`).

## Bash Permissions — `permission.bash`

Declare bash command patterns independently of any MCP server:

```yaml
---
name: playwright-cli
description: Playwright CLI skill
permission:
  bash:
    "playwright-cli *": "allow"
---
```

`collectSkillBashPermissions()` reads `permission.bash` from every SKILL.md. `injectSkillBashPermissions()` injects missing patterns into `agent.permission.bash` for any agent that opts in to the skill via `permission.skill`. Injection rules:

- Skill-level deny for that skill → no injection.
- Pattern value is `"deny"` → pattern is skipped.
- Agent already declares that pattern → not overwritten.
- `permission.bash` is lazily initialised on the agent (only created when a non-deny pattern is actually injected).

Keys may contain spaces and glob patterns (e.g. `"playwright-cli *": "allow"`).

## Skill-Directed Agent Opt-In — `agents:`

Declare which agents should automatically receive `permission.skill["<skillName>"] = "allow"` at startup:

```yaml
---
name: my-skill
description: My skill
agents:
  - coder
  - reviewer
---
```

`collectSkillAgents()` reads the `agents:` list and returns a `SkillAgentIndex`. `injectSkillAgentPermissions()` writes `permission.skill["my-skill"] = "allow"` into each listed agent's config before MCP and bash permission injection runs — so those agents also receive the skill's MCP tools and bash patterns automatically.

Rules:
- Non-overwrite: existing `permission.skill["my-skill"]` entries on the agent are kept as-is.
- Unknown agent name → `logger.warn` and the entry is skipped.
- Agent names are validated with `isSafePermissionSubKey` plus a control-character check.
- Maximum 50 agents per skill.

**Design note**: `agents:` couples a skill to project-specific agent names. Use it for first-party project skills, not portable community skills.

## Execution order in `config()` callback

```
collectSkillAgents        → injectSkillAgentPermissions
collectSkillMcps          → mergeSkillMcps → injectSkillMcpPermissions
collectSkillBashPermissions → injectSkillBashPermissions
```

Agent opt-in (`agents:`) always runs first so that the agents are already opted-in when MCP and bash injection checks `permission.skill`.

## Agent opt-in from the agent side

Agents can also opt in to a skill manually via their own frontmatter:

```yaml
permission:
  skill:
    my-skill: "allow"   # or "*": "allow" for all skills
```

A skill-level `"deny"` overrides any wildcard `"allow"`:

```yaml
permission:
  skill:
    "*": "allow"
    my-skill: "deny"   # blocks my-skill specifically
```

## Conflict resolution summary

| Scenario | Result |
|---|---|
| Two skills declare the same MCP key | First-seen wins; second skill logs a warning |
| User config defines an MCP key that a skill also declares | User config wins |
| Skill declares agent opt-in for an unknown agent name | Warning logged; entry skipped |
| Agent already has `permission.skill["<skillName>"]` set | Not overwritten |
| Agent already has a prefixed MCP permission key | Not overwritten |
| Agent already has a bash pattern the skill would inject | Not overwritten |
