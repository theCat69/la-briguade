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

## {env:VAR_NAME} token resolution

// resolveEnvTokens() is applied to: command elements, environment record values, header values.
// Behaviour:
//   - Trims the var name before lookup (e.g. {env: FOO } → process.env["FOO"]).
//   - Unset variable → empty string + console.warn.
//   - After substitution in a command element, if the resolved value contains
     //     disallowed shell metacharacters (; | & ` < > ! $) the element is
//     replaced with "" and a warning is emitted. This prevents command injection
//     via a compromised environment variable.
```
