<!-- Pattern: skill-embedded-mcp — Skill frontmatter-declared MCP server registration -->

```typescript
// SKILL.md frontmatter can declare MCP servers that la-briguade registers at startup.
// Local MCP: command must be a string[] argv-style command (no shell string).
// Use {env:VAR_NAME} tokens to inject environment variable values at startup (not shell syntax).
---
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
    # {env:CONTEXT7_API_KEY} is resolved from process.env at startup.
    # If the variable is unset, la-briguade warns and passes an empty string.
    command: ["npx", "-y", "@upstash/context7-mcp@2.1.7", "--api-key", "{env:CONTEXT7_API_KEY}"]

  docs:
    type: remote
    url: https://mcp.example.com/sse
    headers:
      # Use {env:VAR} for secrets — never hardcode tokens in content files.
      Authorization: "Bearer {env:MY_DOCS_TOKEN}"
    timeout: 4000
---

## What gets registered

// Startup collection parses `attributes.mcp` and writes each entry into `config.mcp`.
// If user config already defines an MCP with the same key, user config wins.
// `command` is always argv array format (e.g. ["npx", "-y", "pkg@version"]).
// Permission injection index is also built per skill dir basename:
// - default (no permission block): { "<id>_*": "allow" }
// - custom block: each key is pre-prefixed ("*" -> "<id>_*",
//   "resolve-library-id" -> "<id>_resolve-library-id").
// Agents that allow a skill via permission.skill["<skill>"] or wildcard
// permission.skill["*"] automatically receive missing prefixed tool permissions.

## Skill-directed agent opt-in — `agents`

// SKILL.md can optionally declare agent names that should auto-receive
// permission.skill["<skillName>"] = "allow" before MCP/bash injection.
// NOTE: this intentionally couples a skill to project-specific agent names,
// so use it for first-party project skills, not portable community skills.

---
agents:
  - my-agent
---

// Example effect for skill dir name "my-skill":
// before: permission.skill = { "*": "deny" }
// after:  permission.skill = { "*": "deny", "my-skill": "allow" }
// Then MCP and permission.bash entries for "my-skill" can be injected.

## {env:VAR_NAME} token resolution

// resolveEnvTokens() is applied to: command elements, environment record values, header values.
// Behaviour:
//   - Trims the var name before lookup (e.g. {env: FOO } → process.env["FOO"]).
//   - Unset variable → empty string + console.warn.
//   - After substitution in a command element, if the resolved value contains
     //     disallowed shell metacharacters (; | & ` < > ! $) the element is
//     replaced with "" and a warning is emitted. This prevents command injection
//     via a compromised environment variable.

## Non-MCP skill permissions — `permission.bash`

// SKILL.md can also declare bash command permission patterns.
// These are injected into agents that opt into the skill via `permission.skill`.
// No prefix is applied — patterns are injected verbatim into `permission.bash`.

---
permission:
  bash:
    # Allow any playwright-cli subcommand (glob pattern)
    "playwright-cli *": "allow"
---

// Agent frontmatter that opts in:
// permission:
//   skill:
//     playwright-cli: "allow"   ← or "*": "allow"
//
// Result injected at startup (agent receives):
// permission:
//   skill:
//     playwright-cli: "allow"
//   bash:
//     "playwright-cli *": "allow"   ← injected from skill frontmatter
//
// Injection rules (same as MCP):
// - deny in skill permission → no injection for that skill
// - deny value in bash block → pattern is skipped
// - existing pattern in agent config → not overwritten (agent wins)
// - permission.bash initialized as {} if not present on the agent
//
// In la-briguade.jsonc (user config), nested permission is valid:
// {
//   "agents": {
//     "coder": {
//       "permission": {
//         "bash": { "playwright-cli *": "allow" }
//       }
//     }
//   }
// }
```
