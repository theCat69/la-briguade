## Context

This change adjusts documentation-driven behavior in content artifacts, not runtime code paths. The proposal introduces two capabilities: (1) remove redundant `agents:` generation guidance from `init-implementer` auto-inject skill output, and (2) make git-diff skill loading conditional in reviewer-family agents when diff context is already supplied by the invoking prompt.

## Goals / Non-Goals

**Goals:**
- Define implementation-ready wording updates for `content/commands/init-implementer.md` and reviewer-family agent docs.
- Preserve existing fallback safety guidance to load git-diff when diff context is absent.
- Avoid introducing new permission mechanisms; use existing skill/agent permission model.

**Non-Goals:**
- No changes to TypeScript runtime modules (`src/**`) or plugin registration logic.
- No schema, dependency, or CLI behavior changes.
- No broad prompt rewrites beyond the targeted wording scope.

## Decisions

1. **Treat this as content-contract refinement only**
   - Rationale: The requested behavior is achieved by changing generation and reviewer instructions in markdown artifacts.
   - Alternative considered: code-level enforcement in `src/plugin/auto-inject.ts`; rejected because current request is wording/output policy, not runtime enforcement.

2. **Remove generated `agents:` guidance from init-implementer output expectations**
   - Rationale: generated `agents:` lists are redundant for the targeted flow and can create unnecessary coupling to agent names.
   - Activation model: after removal, skill activation continues through existing agent-side `permission.skill` / project configuration opt-in only, with no replacement generated activation step.
   - Alternative considered: keeping `agents:` as optional template text; rejected to prevent recurring redundant output.

3. **Use conditional git-diff wording in reviewer-family prompts**
   - Rationale: Prompts should not force git-diff loading when a parent prompt already includes the required diff context.
   - Alternative considered: removing git-diff guidance entirely; rejected because fallback behavior is needed when diff context is missing.

## Risks / Trade-offs

- **[Risk] Ambiguous “diff context is provided” interpretation** → Mitigation: specify explicit condition language using “sufficient diff context” (“if invoking prompt already includes sufficient staged/unstaged diff context, skip loading git-diff”).
- **[Risk] Inconsistent wording across three agents** → Mitigation: apply shared conditional phrasing pattern to reviewer, security-reviewer, and librarian.
- **[Trade-off] Less prescriptive default flow** → Mitigation: keep mandatory fallback instruction when diff is absent.

## Migration Plan

1. Update target markdown artifacts with the new wording.
2. Validate OpenSpec change artifacts and confirm tasks are apply-ready.
3. No runtime migration or rollback steps required; revert markdown wording if needed.

## Open Questions

- None for implementation readiness.
