---
description: "Initialize and verify repository-local OpenSpec configuration before planning or implementation workflows."
---

You are running the `openspec-init` command. Follow every step in order. Do NOT skip steps.

---

## Step 0 — Scope and Safety Contract

This command initializes OpenSpec for the current repository only.

- Use repository-local path: `openspec/config.yaml`.
- Default behavior is non-destructive and idempotent.
- Never use `openspec init --force` unless the user explicitly asks for repair or reinitialization.

---

## Step 1 — Verify OpenSpec CLI Availability

Before reporting success, explicitly confirm the `openspec` CLI is available.

If the CLI is not available, stop and report:

> "OpenSpec CLI is not available. Install or make `openspec` available in PATH, then re-run `/openspec-init`."

Do not continue when the CLI check fails.
Treat this as a blocked setup outcome for this command.

---

## Step 2 — Check Current Repository Initialization State

Check whether either `openspec/config.yaml` or `openspec/config.yml` already exists.

- If either file exists:
  - Treat the repository as initialized.
  - Do not overwrite existing values.
  - Continue to Step 4 to verify and optionally fill missing optional fields from repo context.

- If neither file exists:
  - Continue to Step 3.

---

## Step 3 — Run Default Initialization

Run `openspec init` from the repository root.

Default behavior must stay non-destructive.
Do not use `--force` in this default path.

---

## Step 4 — Populate `openspec/config.yaml` from Repository Context (Additive)

Determine the active config path (`openspec/config.yaml` preferred, otherwise `openspec/config.yml`).

Read the config and treat these facts as contract:

- `schema` is required.
- `context` is optional.
- `rules` is optional.
- Default `openspec init` typically writes only `schema: spec-driven`.

Populate only when safe and additive:

1. Keep existing `schema` value unless it is missing.
2. Never delete or replace user-provided `context`/`rules`.
3. Fill missing optional fields using high-confidence repo signals when available (for example: package manager/runtime files, dependency manifests, test/build tooling, existing standards in `README.md`/`AGENTS.md`, and current project structure).
4. Keep generated values concise and repo-local (no global machine assumptions).

If you need confirmation of current OpenSpec config semantics before editing, look up external context first.

### Insufficient-Context Fallback (Targeted Interview)

If repository context is insufficient to infer useful optional content (for example: effectively empty repo or weak/conflicting signals), run a minimal interview instead of inventing values.

Ask only the minimum relevant questions needed to fill missing fields:

1. One-sentence project context (what is being built and for whom).
2. Primary stack/conventions that should guide generated specs/tasks.
3. Any must-follow OpenSpec artifact rules (proposal/spec/design/tasks), if they have any.

Do not ask questions for fields that are already confidently inferred or already present in config.

---

## Step 5 — Verify Final Configuration Outcome

After initialization/fill, verify the final config file exists at `openspec/config.yaml` or `openspec/config.yml`.

Then verify:

1. `openspec` CLI availability has been explicitly confirmed.
2. Config file exists in this repository.
3. Config includes `schema`.

- If verification passes: report success and state that planning/implementation commands can proceed.
- If config file is absent or invalid: report setup as incomplete and instruct the user to run explicit repair only if they want reinitialization:

> "OpenSpec init did not produce `openspec/config.yaml` (or `openspec/config.yml`). If you want to repair or reinitialize this repository's OpenSpec setup, run `openspec init --force`, then re-run `/openspec-init` to verify."

Never run `openspec init --force` unless the user explicitly requests repair/reinitialization.

---

## Final Output Contract

Return exactly one clear status:

- **Initialized and configured** — config created (or found), verified, and optional fields were filled from repo context and/or targeted interview.
- **Already initialized** — config already existed, verified, and no additive fill was required.
- **Repair required** — config missing after default init; optional explicit `openspec init --force` path provided.
- **Blocked (CLI unavailable)** — `openspec` is not available in PATH; initialization cannot proceed until CLI installation/access is fixed.
