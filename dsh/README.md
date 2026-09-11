# la-briguade-dsh

Native DeepSeek Harness (DSH) profile bundle for la-briguade's canonical engineering
workflows and personas.

## Local install

```bash
# From the repository root
npm run build:dsh
dsh plugin --profile tui add ./dsh
```

The bundle targets the DSH `0.1.5-rc.2` package family and requires the profile's `agents`,
`agent-presets`, `skills`, `tools`, and `subagents` services. It is experimental while DSH
is pre-1.0.

## Included catalog

- All 17 canonical commands as user-invocable `la-briguade-*` workflow skills.
- Selectable primary presets: `builder`, `orchestrator`, `planner`, and `ask`.
- Generated canonical specialist prompts for coder, architecture, design, review, security,
  context gathering, and sidekick roles.
- `la_briguade_delegate`, a cancellable `spawn`/`fork` delegation tool with per-role tool
  filters and a configurable maximum delegation depth.
- `la_briguade_sidekick`, which creates or resumes DSH continuable code-review,
  security-review, and documentation-sync children.
- `la_briguade_personas` and `la_briguade_status` diagnostics.
- Native edit-mismatch recovery through DSH tool lifecycle interception.

The generation script emits `content/manifest.json`, generated workflow skills, specialist
prompt artifacts, and selectable preset compositions. Edit the repository's top-level
`content/` source only; package `content/` and `presets/` are generated.

## Security model

This bundle does **not** import OpenCode permissions, shell grants, external-directory
permissions, model routes, or skill metadata as DSH authority. DSH's profile sandbox and
approval policy remain authoritative. The adapter applies a conservative role matrix: coding
is allowed only the ordinary core tools that the profile permits; reviewers/context roles are
read/search only; and documentation sidekicks are constrained to documentation work.

MCP is disabled unless explicitly configured. The bridge supports DSH-native stdio and
Streamable HTTP MCP tool servers only. `{env:NAME}` placeholders are resolved at activation
without logging or generating their values. MCP Resources, Prompts, and legacy SSE-only
endpoints are not supported.

## Test

```bash
npm run test:dsh
```

For a release check, also run from the repository root:

```bash
npm run build
npm test
npm audit
npm_config_cache=/tmp/la-briguade-npm-cache npm pack --dry-run
```
