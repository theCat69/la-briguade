<!-- Pattern: skill-embedded-mcp — Skill frontmatter-declared MCP server registration -->

```typescript
// SKILL.md frontmatter can declare MCP servers that la-briguade registers at startup.
// Local MCP: command must be a string[] argv-style command (no shell string).
---
mcp:
  playwright:
    type: local
    command: ["npx", "-y", "@playwright/mcp@latest"]
    environment:
      PLAYWRIGHT_BROWSERS_PATH: "0"
    timeout: 5000

  docs:
    type: remote
    url: https://mcp.example.com/sse
    headers:
      Authorization: Bearer my-actual-token
    timeout: 4000
---

## What gets registered

// Startup collection parses `attributes.mcp` and writes each entry into `config.mcp`.
// If user config already defines an MCP with the same key, user config wins.
// `command` is always argv array format (e.g. ["npx", "-y", "pkg@version"]).
```
