---
name: context7
description: Fetch up-to-date, version-specific library/framework documentation and code examples via the Context7 MCP server.
mcp:
  context7:
    type: local
    command:
      - npx
      - -y
      - "@upstash/context7-mcp@2.1.7"
      - --api-key
      - "{env:CONTEXT7_API_KEY}"
---

# Context7 MCP Skill

Context7 is an MCP server that provides up-to-date, version-specific library and
framework documentation, plus practical code examples, directly to LLM agents.

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

## API key

`{env:CONTEXT7_API_KEY}` is resolved at startup from the
`CONTEXT7_API_KEY` environment variable.

If `CONTEXT7_API_KEY` is not set, la-briguade logs a warning and passes an
empty value to `--api-key`. Context7 still works with public rate limits.

To configure a key, set it in your shell profile or current shell session, for
example: `export CONTEXT7_API_KEY=your-key`.
