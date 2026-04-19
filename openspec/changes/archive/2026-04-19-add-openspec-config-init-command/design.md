## Context

The repo needs a new slash command that initializes OpenSpec for the user’s current repository before any planning or implementation flow. Upstream and archived change context are consistent: `openspec init` is the canonical setup entrypoint, it writes/owns `openspec/config.yaml`, rerunning it is non-destructive, and `--force` is reserved for explicit repair/override cases. Existing OpenSpec-aware commands (`plan-prd`, `implement-prd`) should assume setup is explicit rather than silently creating config.

## Goals / Non-Goals

**Goals:**
- Add a dedicated command definition in `content/commands/` for repository-local OpenSpec initialization.
- Make setup behavior explicit, safe, and scoped to the current working repository.
- Integrate workflow guidance so users are directed to initialize before `plan-prd` / `implement-prd`.
- Preserve non-destructive repeat runs and surface `--force` only as an intentional repair path.

**Non-Goals:**
- No change to OpenSpec CLI behavior or config schema ownership.
- No automatic background initialization during planning/implementation.
- No support for alternate config paths or legacy `@openspec/config.yaml`.

## Decisions

1. **Dedicated explicit command**  
   Add a new slash command whose sole responsibility is guiding/executing `openspec init` in the current repo.  
   **Rationale:** Keeps setup discoverable and consistent with archived expectations.  
   **Alternative rejected:** Auto-init inside `plan-prd` / `implement-prd`; rejected because it hides side effects.

2. **Current-repository scope**  
   The command must target the user’s current working directory and validate success by referencing `openspec/config.yaml`.  
   **Rationale:** Prevents cross-repo confusion and aligns with repo-local configuration ownership.

3. **Non-destructive by default**  
   Default flow uses plain `openspec init`; `--force` is mentioned only for explicit repair when config is missing/corrupt or the user requests overwrite behavior.  
   **Rationale:** Matches upstream contract and reduces accidental config churn.

4. **Workflow integration by instruction, not mutation**  
   Update `plan-prd` and `implement-prd` guidance to check for setup readiness and redirect users to the init command when needed.  
   **Rationale:** Maintains clear separation between setup and downstream workflows.

## Risks / Trade-offs

- **Extra step for users:** Explicit setup adds friction, but improves operational safety and auditability.
- **CLI availability failures:** If `openspec` is unavailable, the command must fail with actionable remediation rather than partial setup claims.
- **Stale assumptions in downstream commands:** If plan/implement prompts are not updated, users may still hit avoidable failures.

## Migration Plan

- Introduce the new command definition.
- Update `plan-prd` and `implement-prd` instructions to require existing OpenSpec setup and redirect when absent.
- Document that existing repos can safely run the init command again; reserve `--force` for repair scenarios.
- No content migration is needed because `openspec/config.yaml` remains the canonical path.

## Open Questions

- What slash command name best fits existing naming conventions?
- Should downstream commands hard-stop when `openspec/config.yaml` is absent, or allow a soft redirect message first?
- Should the init command verify CLI presence before suggesting execution steps, or keep validation entirely within runtime flow?
