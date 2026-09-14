# la-briguade-codex

Best-effort OpenAI Codex CLI bundle for la-briguade's canonical workflows and personas. It is a
Codex-native artifact bundle, not an OpenCode compatibility layer.

## Build and install

```bash
# From the repository root
npm run build:codex
npx --prefix codex la-briguade-codex install /path/to/project
```

The installer writes persona prompts under `.agents/personas/`, workflow skills under `.agents/skills/`, and creates `AGENTS.md`.
It refuses to overwrite an existing `AGENTS.md`; merge the generated instructions manually in that
case. Codex sandbox, approval, model, network, and process policies remain authoritative.

## Included

- Four primary personas: builder, orchestrator, planner, and ask.
- Canonical specialist prompts and all 17 workflows as user-invocable Codex skills.
- Prompt-level delegation and persistent-sidekick protocols with a default depth limit of one.
- Explicit stdio/Streamable HTTP MCP configuration template and bundled MCP provenance.
- Workspace auto-injection guidance, allowlist guidance, and secret-safe environment-token guidance.

Codex CLI does not expose every DSH primitive consistently across releases. Delegation, persistent
sidekicks, persona selection, and MCP mounting therefore use documented Codex-native approximations
where necessary; the generated `AGENTS.md` states the boundary.

## Model-free validation

```bash
npm run test:codex
```

The model-free smoke test validates the generated manifest, persona/workflow artifacts, and MCP
declarations; it never starts Codex or calls a model. `npm run test:codex` rebuilds the bundle and
runs the complete Codex test suite, including this smoke test.

## Compatibility exclusions

The adapter intentionally does not provide edit old-string-mismatch recovery, empty-response
diagnostics, or bounded-content validation.
