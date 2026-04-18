---
name: project-build
description: Build commands, prerequisites, environment setup, and release workflow for la-briguade
agents:
  - coder
  - builder
  - orchestrator
---

## Scope

- **In scope**: local environment prerequisites, build/test/schema generation commands,
  CI/release validation steps, and publish-time safeguards.
- **Out of scope**: product feature behavior, runtime business logic, and content authoring policy.

## Invariants

- You **MUST** validate Node and TypeScript versions before relying on build output.
- You **MUST** run build/test commands from project root.
- You **MUST NOT** treat `dist/` as source of truth; generated artifacts are disposable.
- You **MUST** keep schema generation aligned with current compiled Zod output.
- You **MUST** fail the workflow when build or test commands fail.
- You **MUST NOT** publish when security audit reports high/critical vulnerabilities.

## Validation Checklist

Run and verify:

```bash
npx tsc --version
node --version
npm run build
npm test
npm run generate-schema
```

Release gate (before publish):

```bash
npm run prepublishOnly
npm audit
```

## Failure Handling

- If prerequisites are missing or version-mismatched, stop and report the exact mismatch.
- If build/test fails, do not continue to schema or publish steps; fix root cause first.
- If schema generation fails, treat release as blocked until regenerated from current source.
- If audit reports high/critical issues, block release and document mitigation or deferral.

## Prerequisites

- **Node.js ≥ 22** — required by `engines` field in `package.json`
- **npm** (for publishing and `package-lock.json`) or **bun** (for local dev — `bunfig.toml` present with `install.peer = true`)
- Peer dependency: `@opencode-ai/plugin ^1.4.0` must be installed in the host project consuming this plugin
- TypeScript compiler: `npx tsc --version` should report ≥ 5.8.0

## Environment Setup

```bash
npm install        # or: bun install
```

No `.env` file required — the plugin has no runtime secrets or credentials.

Verify setup:
```bash
npx tsc --version  # should print Version 5.8.x or higher
node --version     # should print v22.x or higher
```

## Build Commands

| Command | Purpose |
|---|---|
| `npm run build` | Compile TypeScript → `dist/` via `tsc` |
| `npm run dev` | Watch mode — `tsc --watch`, recompiles on save |
| `npm run clean` | Delete `dist/` (`rm -rf dist`) |
| `npm run generate-schema` | Build then generate `schemas/la-briguade.schema.json` from Zod output |
| `npm run prepublishOnly` | Runs `clean`, `build`, and `generate-schema` automatically before `npm publish` |
| `npm test` | Run test suite once — `vitest run` |
| `npm run test:watch` | Run tests in watch mode — `vitest` |

## Output Structure

After `npm run build`, `dist/` mirrors `src/`:

```
dist/
  index.js          ← plugin entry point (main)
  index.d.ts        ← type declarations
  cli/
    index.js        ← imported by bin/la-briguade.js
  plugin/
    agents.js
    commands.js
    skills.js
  hooks/
    index.js
  utils/
    frontmatter.js
    read-dir.js
  types/
    plugin.js
```

## CLI Entry Point

`bin/la-briguade.js` has a `#!/usr/bin/env node` shebang and imports `../dist/cli/index.js`. It must be built before running `npx la-briguade`.

## Development Workflow

```bash
# Terminal 1: watch compiler
npm run dev

# Terminal 2: test plugin via CLI
node bin/la-briguade.js doctor
```

No dev server — this is a CLI plugin. There is no HTTP server to start.

## CI/CD Pipeline

No CI config currently in repo. **Recommended**: add a GitHub Actions workflow:

```yaml
on: [push, pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run build
      - run: npm test
```

## Release Workflow

1. Bump `version` in `package.json`
2. Update `CHANGELOG.md`
3. Run `npm run prepublishOnly` (clean + build + generate-schema)
4. Run `npm test` — all tests must pass
5. Run `npm audit` — no high/critical vulnerabilities
6. `npm publish`

> **Never commit `dist/` or `node_modules/`** — both are in `.gitignore`. Published package includes `dist/`, `content/`, `bin/`, and `schemas/` (declared in `package.json` `files` field).

## JSON Schema

`schemas/la-briguade.schema.json` is generated at publish time by `scripts/generate-schema.mjs`. It reads the compiled Zod output from `dist/config/schema.js` and wraps it with `$id`, `$schema`, `title`, and `description` fields.

- **Generation command**: `npm run generate-schema`
- **Canonical unpkg URL**: `https://unpkg.com/la-briguade/schemas/la-briguade.schema.json`
- **Local reference** (for projects with the package installed): `./node_modules/la-briguade/schemas/la-briguade.schema.json`
- The schema is included in the npm published package via the `schemas` entry in `package.json` `files`.

> **Note**: Do not commit manually-edited versions of `schemas/la-briguade.schema.json` — always regenerate via `npm run generate-schema` to keep it in sync with `src/config/schema.ts`.

## Dependency Alignment

Run `npm outdated` before each release to detect stale dependencies.

- `commander` is at v14 — review `src/cli/index.ts` for API changes before upgrading to v15+.
- Keep `@types/node` pinned to the Node 22 LTS line (`^22.0.0`) — do not follow Node version bumps unless `engines.node` is updated first.
- See the `## Dependency Guidelines` section in `project-coding/SKILL.md` for the full per-package audit table and update rules.
