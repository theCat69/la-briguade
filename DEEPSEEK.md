# DeepSeek Harness Support

la-briguade includes an experimental, native DeepSeek Harness (DSH) profile bundle in
`dsh/`. It does not load the OpenCode plugin or transfer OpenCode permissions into DSH.

> [!WARNING]
> The adapter was exercised against the DSH component package family `0.1.5-rc.2`.
> The local `dsh` launcher may report a different release candidate. Pin and test the complete
> profile before relying on it for production work.

## Install

```bash
npm run build:dsh
dsh plugin --profile web add ./dsh
dsh web
```

Use the shipped `web` profile for an interactive user interface. The bundle needs `agents`,
`skills`, `tools`, and `subagents`; its selectable primary presets additionally require a host
`agent-presets` row. The Web profile supplies that row. A bare profile with no preset roster can
still load the adapter's skills and tools, but cannot expose la-briguade's selectable presets.
Configured MCP servers additionally require the DSH MCP client and its services. The profile's
sandbox, approval, network, and process policies always remain authoritative.

## Implemented DSH-native capabilities

| Capability | Status | Current behavior |
|---|---|---|
| Command workflows | Available | Preparation generates all 17 canonical commands as `la-briguade-<command>` user-invocable skills. |
| Primary personas | Available | Generated selectable presets: `builder`, `orchestrator`, `planner`, and `ask`. |
| Specialist prompts | Available | Enabled canonical specialist prompts are generated into the bundle and used by `la_briguade_delegate`. |
| Delegation | Available | `la_briguade_delegate` accepts a specialist, standalone task, and required `spawn` or `fork` mode; it validates input, applies the role policy, forwards cancellation, bounds output, and disposes one-shot children. |
| Persistent sidekick | Available with limits | `la_briguade_sidekick` creates or resumes a DSH continuable child for code review, security review, or documentation sync. `new_session` is currently a required boolean parameter. |
| Edit recovery | Available | A `tools/post-execute` interceptor appends a reread hint to recognized edit old-string mismatch failures. |
| Empty-response reporting | Best effort | The adapter registers an `agent/turn-stopping` listener when the host accepts that event; it logs a warning and never retries automatically. |
| MCP configuration | Available with limits | Explicit adapter config maps stdio and Streamable HTTP servers to the native DSH MCP client. |
| Diagnostics | Available | `la_briguade_personas` lists enabled roles; `la_briguade_status` reports enabled personas, workflows, delegation depth, and safe aggregate auto-injection facts. |
| Auto-injected skills | Available with limits | Generated bundled guidance is selected from bounded DSH-filesystem inspection of the active session workspace and appended as one stable preset-scoped system-prompt section. |

## Intentional limitations and differences

- OpenCode `permission`, `agents`, `detect`, shell, external-directory, model, and embedded MCP
  metadata are not imported as DSH authority or behavior.
- The generated command bodies retain their canonical instructions, but OpenCode-only metadata
  such as command agent/model/subtask hints is not translated into DSH orchestration.
- The adapter does **not** currently apply source `model`, `variant`, `temperature`, `top_p`, or
  `maxSteps` values. DSH profile route selection remains authoritative.
- `autoInject` is active only in generated la-briguade primary preset scopes. It defaults to
  `enabled: true` and `maxDepth: 0` (bounded from 0 through 8), scans only the active session
  workspace through DSH filesystem services, and caches a deterministic rendered block per
  session/workspace/preset/depth. Relevant successful DSH `write` and `edit` calls invalidate that
  workspace result for one controlled refresh. It does not read OpenCode global/project roots,
  honor OpenCode permissions, or grant authority from canonical frontmatter.
- `contentRoots` and `modelPolicies` remain inactive runtime features. Vendor prompts and agent
  model-specific prompt sections are not installed by this adapter.
- Output truncation remains host-provided: the disabled OpenCode truncation behavior was not copied.
- Documentation-sync sidekicks receive a documentation-only instruction; it is not path or
  file-extension enforcement. Review profile sandbox policy before allowing write/edit tools for
  this mode.
- Sidekick reuse is tracked for the active adapter lifetime. A profile reload creates a new manager;
  it does not rediscover a prior child solely from durable storage.

## Security boundary

The adapter never inherits an OpenCode permission map. It supplies each child with a
role-specific tool-use instruction: coding roles use core read/write/edit/search/bash/skill tools,
review and local-context roles use read/search/skill tools, and external-context roles use DSH web
tools. In DSH Web, those core tools are agent-preset scoped, but native child `toolFilter` accepts
only global tools; passing the canonical allowlists would reject the child before it starts. The
adapter consequently relies on the child instruction and DSH's active profile, which remains
authoritative for tool visibility, sandboxing, and approval outcomes.

Bundled generated skills can declare MCP servers in `SKILL.md` frontmatter. At activation, the
adapter discovers those package-owned declarations and mounts enabled entries automatically; for
example, the bundled Context7 skill starts its stdio server when its command is available. Explicit
adapter `mcp` configuration overrides a bundled declaration with the same key. Only stdio and
Streamable HTTP **tools** are mapped; legacy SSE-only endpoints, MCP Resources, and MCP Prompts
are not supported. `{env:NAME}` tokens are resolved in memory at activation and are not included in
generated artifacts or status output. Missing tokens produce a redacted diagnostic. MCP tool
visibility is profile-wide after mounting; the optional per-server `personas` config field is
reserved and is not enforced yet. This discovery intentionally reads only the generated bundled
catalog, not OpenCode global or project skill roots.

## Configuration

Operational settings are:

- `maxDelegationDepth` — integer from 1 through 8; defaults to 1.
- `autoInject.enabled` — defaults to `true`; set false to omit all auto-injected guidance and workspace detection.
- `autoInject.maxDepth` — integer from 0 through 8; defaults to 0 and limits nested manifest detection.
- `enabledWorkflows` and `enabledPersonas` — non-empty lists act as allowlists; absent or empty
  lists keep the complete generated catalog.
- `mcp` — up to 10 explicit server definitions, each with `transport`, `serverName`, and either
  stdio `command`/`args` or Streamable HTTP `url`. These override an auto-discovered bundled
  skill server with the same key; they are not needed for bundled Context7.

A stdio server additionally accepts `env`, `cwd`, `toolCallTimeoutMs`, and
`failOnStartupError`; an HTTP server accepts `headers`, `toolCallTimeoutMs`, and
`failOnStartupError`. Do not put credentials in profile YAML; use `{env:VAR_NAME}`.

```yaml
- id: la-briguade-dsh
  name: la-briguade-dsh
  config:
    maxDelegationDepth: 1
    autoInject:
      enabled: true
      maxDepth: 0
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

The DSH suite covers canonical generation, the full workflow catalog, persona provenance,
delegation policy validation, MCP secret-safe mapping, edit mismatch recognition, and bounded
content parsing. Generated `dsh/content/` and `dsh/presets/` are artifacts: edit top-level
`content/`, then run `npm run build:dsh`.
