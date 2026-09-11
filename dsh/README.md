# la-briguade-dsh

Experimental native DeepSeek Harness (DSH) profile bundle for la-briguade's canonical
workflows and personas. It is not an OpenCode compatibility layer.

## Local install

```bash
# From the repository root
npm run build:dsh
dsh plugin --profile web add ./dsh
dsh web
```

Use the shipped `web` profile for an interactive UI. The adapter was exercised against the DSH
component package family `0.1.5-rc.2`. It needs `agents`, `skills`, `tools`, and `subagents`.
Selectable primary presets additionally need a host `agent-presets` service; the Web profile
provides it. Configured MCP servers additionally require the native DSH MCP client services.

## Included catalog

- All 17 canonical commands as user-invocable `la-briguade-*` workflow skills.
- Selectable primary presets: `builder`, `orchestrator`, `planner`, and `ask`.
- Generated canonical prompts for all enabled delegation specialists.
- `la_briguade_delegate`: bounded, cancellable `spawn` or `fork` delegation. Its `mode`
  parameter is required.
- `la_briguade_sidekick`: creates or resumes continuable code-review, security-review, and
  documentation-sync children. Its `new_session` parameter is required.
- `la_briguade_personas` and `la_briguade_status`.
- Native edit old-string-mismatch reread feedback through DSH tool interception.

`npm run build:dsh` produces the bundle's workflow skills, persona prompt files, primary preset
compositions, and `content/manifest.json`. Edit top-level repository `content/` only; the package
`content/` and `presets/` directories are generated artifacts.

## Security and support boundary

This bundle does **not** import OpenCode permissions, shell grants, external-directory grants,
agent selection, model routes, or MCP declarations as DSH authority. DSH's active profile
remains responsible for tool availability, sandboxing, approvals, network access, and process
execution.

The adapter gives each specialist a role-specific tool-use instruction: coding roles use core
edit/write/search/bash tools; review and local-context roles use read/search/skill tools; and
external-context roles use DSH web tools. DSH Web mounts those core tools inside the selected
agent-preset scope, while native child `toolFilter` can restrict only global tools; the adapter
therefore does not pass a `toolFilter` that would reject child creation. DSH's active profile
remains the authority for tool visibility, sandboxing, and approvals. The documentation-sync
sidekick is instructed to modify documentation only; this is not path or file-extension
enforcement, so do not enable its write/edit tools without a suitable profile sandbox policy.

MCP is disabled unless configured under this bundle's `mcp` config. It supports native stdio and
Streamable HTTP **tool** servers only. `{env:NAME}` tokens resolve in memory and are not logged or
written to generated content. Legacy SSE-only servers, MCP Resources, MCP Prompts, and
persona-scoped MCP visibility are not implemented.

Source model options and the configuration fields `contentRoots`, `autoInject`, and
`modelPolicies` are not active runtime features. Vendor prompts, model-specific prompt sections,
content overrides, and auto-inject detection also remain unsupported in the current adapter.

See [`../DEEPSEEK.md`](../DEEPSEEK.md) for the full capability matrix and configuration reference.

## Test and release checks

```bash
npm run test:dsh
```

For release validation from the repository root:

```bash
npm run build
npm test
npm audit
npm_config_cache=/tmp/la-briguade-npm-cache npm pack --dry-run
```

The latest audit reports existing high-severity development dependency findings in the
Vitest/Vite/PostCSS graph for which npm reports no fix. Treat a non-zero audit exit as a release
gate until that upstream dependency chain is remediated or risk-accepted.
