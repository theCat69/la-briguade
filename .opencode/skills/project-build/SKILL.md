---
name: project-build
description: Build commands, prerequisites, environment setup, and release workflow for la-briguade
---

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
| `npm run prepublishOnly` | Runs `clean` then `build` automatically before `npm publish` |
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
3. Run `npm run prepublishOnly` (clean + build)
4. Run `npm test` — all tests must pass
5. Run `npm audit` — no high/critical vulnerabilities
6. `npm publish`

> **Never commit `dist/` or `node_modules/`** — both are in `.gitignore`. Published package includes `dist/`, `content/`, and `bin/` (declared in `package.json` `files` field).
