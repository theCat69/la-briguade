<!-- Pattern: agent-permissions — Agent frontmatter tools defaults merged with user overrides -->

### Agent frontmatter (`content/agents/coder.md`)

```yaml
---
description: Production coding agent
model: openai/gpt-4o
tools:
  bash: true
  read: true
  write: false
---

You are the coder agent...
```

### User override (`la-briguade.jsonc`)

```typescript
// Merge precedence (low → high):
//   1) agent frontmatter `tools`
//   2) user config `agents.coder.tools`

{
  "agents": {
    "coder": {
      "tools": {
        "write": true,
        "grep": true
      }
    }
  }
}

// Final merged tools for `coder`:
// { bash: true, read: true, write: true, grep: true }
```
