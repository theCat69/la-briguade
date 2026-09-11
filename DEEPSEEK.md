# DeepSeek Harness Support

la-briguade includes an experimental, native DeepSeek Harness (DSH) profile bundle in
`dsh/`. It does not load the OpenCode plugin or transfer OpenCode permissions into DSH.

> [!WARNING]
> The supported adapter baseline is the DSH package family `0.1.5-rc.2`. The local `dsh`
> launcher may report a different release candidate; pin and test the complete profile before
> production use.

## Install

```bash
npm run build:dsh
dsh plugin --profile tui add ./dsh
```

The profile must supply `agents`, `agent-presets`, `skills`, `tools`, and `subagents`.
MCP support additionally requires the DSH MCP client services. The profile's sandbox,
approval, network, and process policies always remain authoritative.

## Available DSH-native capabilities

| Capability | Status | Details |
|---|---|---|
| All 17 command workflows | Available | Generated as `la-briguade-<command>` user-invocable DSH skills from canonical Markdown. |
| Primary personas | Available | `builder`, `orchestrator`, `planner`, and `ask` are selectable generated presets. |
| Specialist personas | Available | All canonical specialist prompts are generated and available only through policy-scoped delegation. |
| Delegation | Available | `la_briguade_delegate` supports `spawn` and `fork`, validates input/depth, scopes tools per role, forwards cancellation, bounds output, and disposes one-shot children. |
| Persistent sidekick | Available | `la_briguade_sidekick` uses DSH continuable children for code review, security review, and documentation synchronization. |
| Reliability hooks | Available | A DSH `tools/post-execute` interceptor appends reread guidance to edit old-string mismatch failures. Empty-response lifecycle diagnostics are registered when the host exposes the event. |
| Safe MCP configuration | Available | Explicit DSH config accepts stdio and Streamable HTTP servers, validates namespaces, resolves `{env:VAR}` without logging values, and mounts native MCP clients. |
| Diagnostics | Available | `la_briguade_status` reports safe registration and compatibility diagnostics. |

## Security policy

Canonical OpenCode `permission`, `agents`, `detect`, shell, external-directory, model, and
MCP metadata are never treated as DSH authority. The adapter uses an independent policy:

- coding children may see `read`, `write`, `edit`, `grep`, `glob`, `bash`, and `skill` only
  when the active DSH profile permits them;
- planning, review, security, and local-context roles are read/search/skill only;
- external research exposes only DSH web tools when those tools exist in the profile;
- documentation sidekicks are instructed to edit documentation formats only; and
- all child calls remain subject to DSH approval and sandbox decisions.

MCP is opt-in in adapter configuration. Only stdio and Streamable HTTP tool servers are
supported. Legacy SSE-only definitions, MCP Resources, and MCP Prompts are intentionally
not mapped. Environment tokens are resolved at runtime only; values are never generated,
logged, or reported by `la_briguade_status`.

## Configuration

The `la-briguade-dsh` Cordis configuration supports bounded `maxDelegationDepth`, optional
workflow/persona allowlists, explicit content roots, auto-injection settings, model policy
hints, and explicit MCP definitions. Unsupported/unsafe configuration fails startup rather
than being silently reinterpreted. Source model metadata is not used to override a selected
DSH model route.

Example MCP configuration (only in a profile explicitly intended to enable it):

```yaml
- id: la-briguade-dsh
  name: la-briguade-dsh
  config:
    mcp:
      docs:
        transport: stdio
        serverName: docs
        command: npx
        args: ["-y", "example-mcp"]
        env: { API_TOKEN: "{env:API_TOKEN}" }
```

## Build and validation

```bash
npm run build
npm run build:dsh
npm run test:dsh
npm test
```

Generated `dsh/content/` and `dsh/presets/` are package artifacts. Edit top-level canonical
`content/` and run `npm run build:dsh`; do not edit generated artifacts manually.
