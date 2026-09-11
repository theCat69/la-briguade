# DeepSeek Harness Support

This document describes the current DeepSeek Harness (DSH) support in la-briguade.
It is the source of truth for the DSH capability boundary. The integration is native:
it does not load the OpenCode plugin entry point or attempt to emulate OpenCode APIs.

> [!WARNING]
> DSH support is experimental. It was implemented and validated against DSH
> `0.1.5-rc.2`, which is pre-1.0. Pin and test the DSH version used in a production
> profile before relying on it for a critical workflow.

## Installation

Install the dedicated DSH profile bundle when it is published:

```bash
dsh plugin --profile tui add la-briguade-dsh
```

From a local checkout, first generate the packaged content and presets:

```bash
node dsh/scripts/prepare.mjs
dsh plugin --profile tui add ./dsh
```

The active profile must provide DSH's standard `agents`, `agent-presets`, `skills`,
`tools`, and `subagents` services. The bundle declares the agent-preset root and
registers its skills and tools without replacing the profile's sandbox or approval
policy.

## Current capabilities

| Capability | DSH status | Notes |
|---|---|---|
| Native profile bundle | **Available** | The independently publishable package is `la-briguade-dsh` under `dsh/`. |
| Selectable primary personas | **Available** | `builder`, `orchestrator`, `planner`, and `ask` are generated DSH agent presets. |
| Canonical persona prompt source | **Available** | Presets are generated from the top-level canonical `content/agents/*.md` files during prepare/pack. |
| Bundled skills | **Available** | The 12 regular la-briguade skills are registered as DSH bundled skills. |
| Project/user DSH skills | **Available through DSH** | DSH's normal `.dsh/skills` and `.agents/skills` roots remain available through its filesystem skill provider. |
| Autonomous implementation workflow | **Available** | `la-briguade-just-do-it` is a user-invocable DSH skill derived from `/just-do-it`. |
| Persona discovery | **Available** | `la_briguade_personas` reports the supported primary and specialist roles. |
| Coder delegation | **Available** | `la_briguade_delegate` starts a fresh, bounded `coder` specialist child. |
| Delegation safety | **Available** | The task is length-validated; the child gets a fixed persona, explicit tool allowlist, depth bound, cancellation signal, and guaranteed disposal. |
| OpenCode configuration and CLI | **Unchanged** | Existing OpenCode installation, overrides, commands, hooks, and CLI behavior remain separate. |

### Current DSH personas

| DSH preset | Source agent | Role |
|---|---|---|
| `builder` | `content/agents/Builder.md` | Direct production implementation. |
| `orchestrator` | `content/agents/Orchestrator.md` | Coordinates multi-agent engineering work. |
| `planner` | `content/agents/Planner.md` | Produces and challenges implementation plans. |
| `ask` | `content/agents/Ask.md` | General assistance and context gathering. |

The initial delegation tool exposes the `coder` specialist. The remaining OpenCode
subagents are not yet registered as DSH delegation targets.

## Deliberately not ported yet

The following items are not part of the current DSH bundle:

- the other OpenCode slash commands;
- persistent `sidekick-agent` sessions;
- OpenCode hook behavior, including output truncation, edit-error recovery, empty-response
  detection, vendor prompt injection, and model-section injection;
- OpenCode agent permission maps and skill-directed agent permissions;
- OpenCode model fields such as `model`, `temperature`, `top_p`, `maxSteps`, and `variant`;
- automatic registration of skill-embedded MCP definitions.

These exclusions are not claims that DSH lacks equivalent primitives. They mean the
mapping has not yet been designed, security-reviewed, and tested for la-briguade.

## MCP definitions: they can be ported

We **can** support MCP servers in DSH. DSH provides the native
`@deepseek-ai/dsh-mcp-client` bridge, which exposes an MCP server's tools as DSH tools
named `mcp__<serverName>__<toolName>`. It supports local `stdio` servers and remote
Streamable HTTP servers, includes connection/reconnection handling, gives every tool
stable server-qualified names, and uses normal DSH cancellation and timeouts.

MCP definitions were intentionally **not copied automatically** in the initial port.
The OpenCode and DSH contracts are similar but not identical:

| Concern | OpenCode source contract | DSH MCP client contract | Required porting decision |
|---|---|---|---|
| Local server transport | `type: local`, argv-style `command` | `transport: stdio`, separate `command` and `args` | Convert the argv safely without shell interpolation. |
| Remote server transport | `type: remote`, currently SSE-oriented | `transport: streamable-http` | Reject or require migration for a source server that only provides legacy SSE. |
| Tool names | OpenCode permission keys are plugin-specific/prefixed | DSH uses stable `mcp__<server>__<tool>` names | Define a compatible, documented naming and collision policy. |
| Environment values | `{env:NAME}` tokens are resolved by la-briguade | DSH starts from a scrubbed environment and accepts explicit `env` | Resolve tokens without logging secrets, and pass only explicitly required values. |
| Headers | Token substitution and OpenCode transport conventions | Explicit Streamable HTTP headers | Validate header values and never serialize credentials into the bundle. |
| Permissions | OpenCode injects skill/agent/MCP permission entries | DSH authority comes from the active profile, sandbox, and scoped tool policy | Keep authority opt-in; do not silently grant MCP tools to every persona. |
| Lifecycle | OpenCode startup registration | DSH profile composition and a live reconnecting client | Define startup-failure, timeout, reload, and disposal behavior. |

Automatic translation would be unsafe because a seemingly equivalent source definition
can change transport behavior or grant a new tool to a DSH persona. For example, a remote
OpenCode SSE endpoint is not necessarily compatible with DSH's Streamable HTTP client,
and an OpenCode `permission` block is not a safe substitute for DSH's profile authority.

### Planned MCP port approach

A follow-up MCP milestone should:

1. define a small validated DSH-specific MCP configuration schema;
2. support only explicitly enabled skills and only DSH-supported transports;
3. translate local argv commands into `command` plus `args` without a shell;
4. resolve `{env:VAR_NAME}` values using the same no-secret-logging rule as OpenCode;
5. mount one `@deepseek-ai/dsh-mcp-client` entry per accepted server;
6. scope MCP tool access to the intended DSH personas with an explicit allowlist;
7. test startup failure, reconnects, naming collisions, cancellation, timeouts, missing
   environment values, and cleanup.

Until that work is complete, add MCP servers through the active DSH profile's own
`cordis.patch.yml` configuration rather than placing them in la-briguade skill
frontmatter.

## Security boundary

The DSH bundle does not import OpenCode permission, MCP, shell, external-directory,
`agents`, or `detect` frontmatter as DSH authority. DSH's active profile remains the
source of truth for:

- filesystem sandbox mode;
- approval policy;
- network access;
- shell/process availability; and
- which MCP client instances and tools exist.

This separation prevents a package update or a Markdown skill from silently broadening
a user's DSH access.

## Build and validation

```bash
npm run build:dsh
npm run test:dsh
npm test
```

`dsh/scripts/prepare.mjs` is the only process that writes the generated `dsh/content/`
and `dsh/presets/` package artifacts. Edit the canonical top-level `content/` source,
then regenerate before testing, packing, or installing from a checkout.
