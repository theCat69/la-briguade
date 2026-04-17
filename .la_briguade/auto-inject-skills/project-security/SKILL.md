---
name: project-security
description: Security guidelines for la-briguade — safe parsing, dependency hygiene, CLI input safety, and secret management
---

## Secrets Management

- **No secrets belong in source code** or content `.md` files — the plugin has no credentials
- No `.env` file is needed — all configuration is structural (file paths, plugin names)
- Never log token values, API keys, or credential-shaped strings
- The `.ai/` directory is gitignored — cache files must never contain secrets (they currently don't)
- If a future feature requires credentials, use the host project's environment variables — never hardcode

## Input Validation

### YAML Frontmatter
All YAML frontmatter from `.md` files is **untrusted input**:
- Parse with `yaml` library using the default `schema: "core"` — this avoids YAML 1.1 quirks (`on`/`off` → boolean, etc.) and disallows custom tags that could execute code
- Set `maxAliasCount` to a safe limit (default is 100) to prevent DoS via YAML alias bombs
- **Always validate the parsed value** before casting — never assume `parseYaml()` returns an object:
  ```typescript
  const parsed = parseYaml(yamlBlock);
  const attributes =
    parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  ```
- **Allowlist frontmatter keys**: agent/command/skill registration modules filter to allowed keys — never spread unknown parsed objects into config

### CLI Arguments
- CLI arguments flow through `commander` — validate types at the commander option level
- Never pass raw `process.argv` values directly to file system operations
- Config file path discovery uses a hardcoded `CONFIG_CANDIDATES` allowlist — never constructs paths from user input

### File Path Construction
- When constructing file paths from filenames derived from directory listings (e.g. agent `.md` filenames), **always sanitize with `path.basename()`** before joining:
  ```typescript
  const safeName = basename(filename); // strip any path traversal components
  const fullPath = join(contentDir, safeName);
  ```
- Never join user-supplied strings to sensitive base paths without `basename()` sanitization

### MCP Env Token Resolution (`{env:VAR_NAME}`)

Skill frontmatter supports `{env:VAR_NAME}` tokens in MCP `command` elements, `environment` values, and `headers` values. The `resolveEnvTokens()` helper in `src/plugin/mcp/collect.ts` enforces the following security constraints:

- **Unset variable in `environment` value** → entry is omitted and `logger.debug` is emitted. Never throws — avoids startup failures from missing optional keys.
- **Unset variable in `command`/`headers` value** → resolves to `""` and emits `logger.warn`. Never throws — avoids startup failures from missing optional keys.
- **Post-substitution command validation** — after substituting the env value into a command element, the resolved string is checked against `DISALLOWED_COMMAND_CHARS` (`/[;|&$\`<>!]/`). Note: `/` and `\` are **not** disallowed (needed for npm scoped packages like `@scope/pkg`). If it matches, the element is replaced with `""` and a warning is logged. This prevents command injection via a compromised or maliciously-set environment variable.
- **Never put secrets in `.md` content files** — always use `{env:VAR}` references. Content files in `content/skills/` are committed to source control.
- **Var name trimming** — the var name is `.trim()`-ed before lookup (e.g. `{env: FOO }` looks up `process.env["FOO"]`). Do not rely on whitespace tolerance in names.

### MCP `permission:` Block Validation

Skill frontmatter MCP entries may include a `permission:` block declaring tool-level permissions for the MCP server's tools. The following constraints are enforced:

- **Values are validated** as `"allow" | "ask" | "deny"` — invalid values are rejected by the Zod schema at startup.
- **Capped at 50 entries** per permission block — `z.record()` is refined to prevent unbounded permission maps.
- **Injection never overwrites** — `injectSkillMcpPermissions()` only adds missing prefixed keys to an agent; if the agent already declares a key (e.g. `"context7_*"`), it is left untouched. This preserves explicit agent overrides.

### JSONC Editing
- Use `jsonc-parser` — `modify()` + `applyEdits()` — for all config file mutations
- **Never use `JSON.parse` + string replacement** on config files (destroys comments, fragile)
- **Never use `eval`, `new Function()`, or dynamic `require()`** anywhere in the codebase

## Dependency Security

- Run `npm audit` before every release — no high/critical vulnerabilities
- Keep `@opencode-ai/plugin` peer dependency pinned to `^1.4.0` — breaking changes are expected on major version bumps; upgrade only when intentional
- `yaml@2.x` and `jsonc-parser@3.x` are low-risk utility libraries — update on minor releases
- `commander@13.x` — stable, minimal attack surface
- After `npm install` of new deps, always re-run `npm audit`

## Prototype Pollution Prevention

- Avoid `Object.assign({}, untrustedObject)` with deeply nested untrusted objects
- When merging frontmatter attributes into config, **explicitly extract allowed properties** rather than spreading unknown objects:
  ```typescript
  // Good — explicit extraction
  const { description, model, temperature } = attributes;

  // Bad — spreads unknown keys
  Object.assign(config.agent[name], attributes);
  ```
- Never use `__proto__`, `constructor`, or `prototype` as dynamic property keys
- `parseFrontmatter()` enforces a `POISON_KEYS` deny-list (`__proto__`, `constructor`, `prototype`) at parse time — silently drops matching keys and logs a warning. All callers benefit automatically.

## Authentication & Authorization

- This plugin runs in the user's local opencode environment — no network authentication is needed
- The `la-briguade doctor` CLI command reads only local config files — no network calls
- Plugin registration happens at opencode startup — no user-facing auth flow required

## Common Vulnerability Checklist

| Vulnerability | Status | Mitigation |
|---|---|---|
| Path traversal | ⚠️ Monitor | Use `path.basename()` on all filenames from dir reads |
| YAML deserialization | ✅ Safe | `schema: "core"` default, no custom tags |
| Prototype pollution | ✅ Safe | Explicit property extraction in all `register*.ts` |
| Code injection | ✅ Safe | No `eval`, `Function()`, or dynamic `require()` |
| JSONC injection | ✅ Safe | `jsonc-parser` modify/applyEdits only |
| MCP command injection | ✅ Safe | `resolveEnvTokens()` validates post-substitution values against `DISALLOWED_COMMAND_CHARS` (`;|&$\`<>!` — `/` and `\` are allowed) |
| Dependency confusion | ⚠️ Pre-release | Ensure `la-briguade` is published to npm before public release |
| Secret leakage | ✅ Safe | No credentials in codebase; `.ai/` gitignored; `{env:VAR}` pattern keeps secrets out of `.md` files |
