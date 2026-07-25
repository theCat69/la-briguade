---
name: serena
description: Semantic code retrieval, editing, refactoring and debugging tools using LSP servers
agents:
  - builder 
  - coder 
mcp:
  serena:
    type: local
    command:
      - "uvx"
      - "--from"
      - "git+https://github.com/oraios/serena"
      - "serena"
      - "start-mcp-server"
      - "--project-from-cwd"
      - "--context"
      - "agent"
      - "--open-web-dashboard"
      - "False"
    enabled: true
---

# Skill: serena

Use Serena as the default MCP for repo-local code understanding, symbol-aware navigation, safe refactoring, and persistent project memory.

## Why Serena is useful

Serena is valuable because it is **structure-aware**, not just text-aware.

It helps an agent:
- find the right files faster
- understand symbols, declarations, implementations, and references
- make safer edits than raw search/replace
- perform cross-file refactors with less risk
- store reusable project knowledge in memories
- inspect diagnostics before and after changes

Use Serena first for **local repository work**.  
Do not use it for external library documentation; use dedicated external-doc tools for that.

---

## When to use Serena

Use Serena when you need to:
- explore an unfamiliar codebase
- locate a class, method, interface, or symbol
- find who calls or implements something
- make precise code edits around existing symbols
- rename or delete symbols safely
- inspect diagnostics in a file
- save project knowledge for future tasks

Prefer Serena over plain text tools when the task is about **code structure**.

