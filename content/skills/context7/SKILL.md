---
name: context7
description: Fetch version-specific external library/framework docs and examples via Context7 MCP when local repo context is insufficient; do not use for repo-local facts.
agents:
  - external-context-gatherer
  - ask
  - builder
mcp:
  context7:
    type: local
    command:
      - npx
      - --prefer-offline
      - "@upstash/context7-mcp@2.1.7"
    environment:
      CONTEXT7_API_KEY: "{env:CONTEXT7_API_KEY}"
---

# Context7 MCP Skill

## Available MCP tools

- `resolve-library-id` — map a library name or query to a Context7 library ID.
- `query-docs` — fetch docs and examples using a Context7 library ID and a query string.

## Agent usage guidance

Use Context7 whenever you need reliable library/framework API details, configuration
guidance, or version-specific examples.

Preferred workflow:

1. If the Context7 library ID is unknown, call `resolve-library-id` first.
2. Call `query-docs` with the resolved ID and a focused query.

When you already know the exact Context7 library ID, use it directly to skip resolution.
