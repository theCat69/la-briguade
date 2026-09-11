# la-briguade-dsh

Native DeepSeek Harness (DSH) profile bundle for la-briguade.

## Install

```bash
dsh plugin --profile tui add la-briguade-dsh
```

For local development from the repository root:

```bash
node dsh/scripts/prepare.mjs
dsh plugin --profile tui add ./dsh
```

The package requires a DSH profile providing `agents`, `agent-presets`, `skills`,
`tools`, and `subagents` services. It targets DSH `0.1.5-rc.2` and is experimental
while DSH is pre-1.0.

## Included MVP

- Read-only selectable DSH presets: `builder`, `orchestrator`, `planner`, and `ask`.
- The la-briguade Markdown skill catalog, registered as bundled DSH skills.
- A user-invocable `la-briguade-just-do-it` skill derived from the OpenCode workflow.
- `la_briguade_personas`, which lists available personas.
- `la_briguade_delegate`, which starts a bounded, fresh `coder` specialist child.

The preparation script copies canonical source content and generates DSH preset
compositions at package build/pack time. Do not edit `content/` or `presets/` in this
package manually; edit the repository's top-level `content/` sources instead.

## Security model

This bundle does not transfer OpenCode permissions, MCP declarations, shell grants,
or hooks into DSH. DSH profile sandbox and approval policies remain authoritative.
The delegation tool supplies a fixed, narrow tool allowlist and validates its task
length and specialist name before starting a child.

## Test

```bash
npm test
```
