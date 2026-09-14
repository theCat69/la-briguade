# Codex CLI Support

la-briguade includes an experimental OpenAI Codex CLI bundle in `codex/`. It generates Codex-native
personas, skills, workflow prompts, MCP metadata, and workspace instructions from the canonical
repository content.

## Install locally

```bash
npm run build:codex
npx --prefix codex la-briguade-codex install /path/to/project
```

The installer places specialist persona prompts in `/path/to/project/.agents/personas/` and workflow
skills in `/path/to/project/.agents/skills/`, then creates `AGENTS.md`.

The automated check is model-free:

```bash
npm run test:codex
```

The model-free smoke test validates the generated manifest, persona/workflow artifacts, and MCP
declarations; it does not launch Codex or call any model. `npm run test:codex` rebuilds the bundle and
runs the complete Codex test suite, including this smoke test. A live Codex check is intentionally
optional because Codex CLI availability, authentication, and model routing belong to the user's
environment.

## Capability boundary

The bundle includes workflows, primary and specialist personas, delegation/sidekick instructions,
explicit MCP configuration, auto-injection guidance, allowlists, delegation-depth guidance, and
secret-safe environment-token guidance. Codex sandbox, approvals, models, network, and process
execution remain authoritative. Edit old-string-mismatch recovery, empty-response diagnostics, and
bounded-content validation are intentionally excluded.

Codex CLI capabilities vary by release. Where native child sessions or persona selection are absent,
the adapter uses prompt/configuration approximations and documents the limitation rather than
claiming exact DSH parity.
