# DeepSeek Harness Full Capability Port Specification

## Status

**Proposed implementation specification**  
**Scope:** Native DeepSeek Harness (DSH) parity for every la-briguade capability that has a safe, supportable DSH-native equivalent.  
**Current adapter:** Experimental MVP in `dsh/`.  
**OpenCode compatibility:** Must remain unchanged.

## Problem statement

la-briguade currently provides an OpenCode-native engineering workflow through Markdown-driven agents, skills, commands, embedded MCP definitions, permissions, runtime hooks, content overrides, and a persistent sidekick review tool. The existing DSH bundle exposes only a deliberately small MVP: four primary presets, bundled skills, one user-invocable workflow, a persona-discovery tool, and fresh delegation to `coder`.

The project needs a complete DSH-native implementation of all portable capabilities. The result must reuse canonical content where semantics are shared, integrate with DSH through Cordis services rather than OpenCode emulation, preserve least privilege, and clearly document differences where there is no exact DSH equivalent.

This specification does **not** require OpenCode source code or OpenCode configuration to run inside DSH. It defines a behavior-preserving DSH adapter.

## Goals

1. Make every canonical la-briguade workflow available through DSH-native user-invocable skills or, when required, dedicated DSH tools.
2. Expose all canonical agent roles as DSH presets and/or delegation-only specialists.
3. Replace the coder-only delegation implementation with role-aware, least-privilege DSH subagent orchestration.
4. Port runtime reliability behavior using DSH hook, tool, and agent lifecycle seams.
5. Replace OpenCode CLI-backed persistent sidekick sessions with DSH continuable subagents.
6. Support safe, explicit translation of compatible skill-embedded MCP servers.
7. Port portable content overrides, auto-inject behavior, and route-specific prompt content with deterministic precedence and bounded reads.
8. Provide a DSH-native configuration, diagnostics, migration guidance, and compatibility policy.
9. Keep the OpenCode package, CLI, configuration, runtime behavior, and tests unchanged.

## Non-goals

- Loading `src/index.ts`, `@opencode-ai/plugin`, or OpenCode configuration mutation code in DSH.
- Treating OpenCode permissions, shell grants, external-directory grants, `agents`, `detect`, or `mcp` frontmatter as DSH authority without an explicit DSH policy.
- Supporting MCP transports not supported by DSH's MCP client, including legacy SSE-only servers.
- Recreating OpenCode's CLI install/uninstall flow when the DSH profile plugin manager already owns that task.
- Building a generic OpenCode-to-DSH plugin compatibility layer.
- Creating a custom DSH Web UI unless an existing DSH surface cannot meet a proven requirement.
- Claiming an exact mapping for OpenCode model fields where the DSH provider/runtime has no equivalent.

## Invariants

### Packaging and source boundaries

- `src/` remains OpenCode-specific and must not acquire DSH runtime dependencies.
- `dsh/` remains the independently packageable `la-briguade-dsh` profile bundle.
- Top-level canonical `content/` remains the source of maintained agent, command, skill, and prompt content.
- Generated `dsh/content/` and `dsh/presets/` remain build artifacts and must not be edited manually.
- New shared code, if introduced, contains only runtime-neutral parsing, validation, identifier, template, or content-model logic.

### Security and authority

- The active DSH profile remains authoritative for sandbox mode, approval policy, network access, shell availability, and installed host services.
- No Markdown content or package update may silently broaden DSH authority.
- Every authority-bearing adapter feature is opt-in, runtime-validated, documented, and tested.
- Content parsing must be bounded, path-safe, symlink-aware where content grants filesystem behavior, and resistant to prototype pollution.
- Credentials and resolved environment values must never be logged, persisted in generated content, or committed.
- All process launches use argv arrays; no shell interpolation or dynamic code execution is permitted.

### Compatibility and diagnostics

- Unsupported source metadata must be ignored only with a visible, source-identified compatibility diagnostic; it must never be silently reinterpreted.
- One invalid optional content item must not prevent unrelated valid content from loading.
- Required service or version failures must fail fast with remediation guidance.
- DSH feature claims must be tested against an exact installed DSH version and recorded in documentation.

## DSH compatibility baseline

The current bundle declares DSH peer dependencies at `^0.1.5-rc.2`, while the local discovery checkout must be re-verified before implementation because pre-1.0 APIs can differ between release candidates.

### Phase-zero compatibility requirements

1. Install and inspect the exact DSH release used for development and CI.
2. Record the resolved package versions and public APIs used by the adapter.
3. Verify, with a minimal composition, these seams:
   - profile-bundle patch loading;
   - preset/persona composition;
   - skill registration;
   - fresh and continuable subagents;
   - scoped tool restriction;
   - agent and tool lifecycle events;
   - system-prompt sections and route inspection;
   - MCP client composition;
   - profile reload/disposal behavior.
4. Pin the first supported compatibility range only after these tests pass.
5. Update `DEEPSEEK.md`, `dsh/README.md`, and the compatibility decision record with the verified version.

## Capability mapping

| OpenCode capability | DSH-native implementation | Support level | Notes |
|---|---|---|---|
| 17 slash commands | User-invocable DSH skills; dedicated orchestration tools only when prompt-only execution is insufficient | Portable | Preserve command bodies and map source metadata deliberately. |
| Primary agents | DSH system agent presets/personas | Direct | Generate from canonical agent Markdown. |
| Subagents | DSH `spawn`, `fork`, and continuable subagents with scoped personas/tools | Direct with policy adaptation | Do not inherit OpenCode permissions. |
| Skills | DSH skill registry and filesystem providers | Direct with precedence adaptation | Keep DSH roots; add optional la-briguade-specific loader only when needed. |
| Model fields | Provider/model, reasoning effort, and output-token policies | Partial | Map only validated equivalents. |
| Edit-error recovery | DSH post-tool execution interceptor | Direct | Preserve safe reread guidance. |
| Empty-response detection | Agent completion/turn lifecycle diagnostics | Adapted | No dependence on OpenCode events or TUI toast API. |
| Output truncation | DSH output retention/spill policy first; optional result policy only if required | Adapted | Current OpenCode truncation is disabled and must not be copied blindly. |
| Vendor/model prompt injection | DSH scoped system-prompt sections | Portable | Must be deterministic and route-aware. |
| Auto-inject skills | Bounded project detection plus scoped prompt injection | Portable | Detection never grants tool authority. |
| Content overrides | DSH filesystem roots plus explicit adapter loader | Portable with different precedence | Do not automatically consume OpenCode roots. |
| Skill MCP definitions | `@deepseek-ai/dsh-mcp-client` plus explicit mapping/policy | Portable for stdio and Streamable HTTP tools | Resources/prompts and SSE-only servers are out of scope. |
| Skill bash/external-directory permissions | DSH profile sandbox/tool policy | Adapted | No direct permission-map import. |
| Persistent sidekick | DSH continuable subagents | Portable | Replace OpenCode CLI process/session lookup. |
| CLI install/uninstall/update | DSH plugin/profile manager | Host-provided | Do not duplicate. |
| Doctor | DSH-native diagnostic/status tool | Portable | Report only safe diagnostic data. |
| Custom UI | Existing DSH skill/persona/subagent surfaces | Not initially needed | Evaluate only after core behavior is complete. |

## Architecture

### Package structure

The DSH package remains rooted at `dsh/` and is published as `la-briguade-dsh`.

Recommended additions:

```text
dsh/
  index.js                       # Cordis entry and thin registration layer
  lib/
    config.js                    # DSH config schema and validation
    content.js                   # Bounded source/override loading and diagnostics
    agents.js                    # Canonical agent normalization and persona metadata
    commands.js                  # Command-to-workflow generation/mapping
    delegation.js                # Specialist catalog and child policy/router
    hooks.js                     # Native DSH lifecycle behavior
    sidekick.js                  # Continuable review orchestration
    prompts.js                   # Vendor/model and auto-inject prompt policy
    mcp.js                       # Accepted MCP mapping and lifecycle composition
    diagnostics.js               # Safe status/doctor reporting
  scripts/
    prepare.mjs                  # Generated package content/presets/workflows
  test/
    *.test.mjs
```

The exact decomposition may change, but `index.js` must remain small and all behavior must have independently testable seams.

### Content normalization

Create a DSH-specific normalized representation for canonical content. It must preserve raw source identity and body while extracting only allowlisted fields.

#### Agent normalization

```ts
type DshAgentDefinition = {
  id: string;
  description: string;
  body: string;
  intent: "primary" | "specialist";
  disabled: boolean;
  modelHint?: string;
  variantHint?: string;
  temperatureHint?: number;
  topPHint?: number;
  maxStepsHint?: number;
  sourcePath: string;
};
```

The normalized representation must never include OpenCode `permission` as authority. Source permission metadata may be retained only for diagnostic reporting.

#### Command normalization

```ts
type DshCommandDefinition = {
  id: string;
  description: string;
  body: string;
  agentHint?: string;
  modelHint?: string;
  subtaskHint?: boolean;
  sourcePath: string;
};
```

#### Skill normalization

DSH requires at minimum a valid name, description, body, invocation flags, and source identity. OpenCode-only frontmatter must be separated into non-authoritative compatibility metadata for later explicit features.

## Functional requirements

### FR-1: Complete workflow catalog

All 17 canonical commands must be available in DSH with stable la-briguade-prefixed identifiers.

| Canonical command | DSH identifier | Required DSH form |
|---|---|---|
| `/init-implementer` | `la-briguade-init-implementer` | User-invocable setup skill |
| `/update-implementer` | `la-briguade-update-implementer` | User-invocable reconciliation skill |
| `/interview` | `la-briguade-interview` | Interactive workflow skill |
| `/critic` | `la-briguade-critic` | Critic workflow skill |
| `/full-review` | `la-briguade-full-review` | Review workflow skill |
| `/go-back-to-work` | `la-briguade-go-back-to-work` | Recovery/resume workflow skill |
| `/unslop` | `la-briguade-unslop` | Interactive cleanup skill |
| `/unslop-loop` | `la-briguade-unslop-loop` | Goal-driven cleanup skill |
| `/refactor` | `la-briguade-refactor` | Multi-stage workflow skill |
| `/local-context-full-gathering` | `la-briguade-local-context-full-gathering` | Parallel context-gathering workflow |
| `/to-spec` | `la-briguade-to-spec` | Specification workflow skill |
| `/to-tickets` | `la-briguade-to-tickets` | Ticket decomposition workflow skill |
| `/implement` | `la-briguade-implement` | Builder-routed implementation skill |
| `/just-do-it` | `la-briguade-just-do-it` | Autonomous implementation workflow skill |
| `/grilling` | `la-briguade-grilling` | Decision-tree interview skill |
| `/handoff` | `la-briguade-handoff` | Redacted handoff skill |
| `/learn` | `la-briguade-learn` | Teaching workflow skill |

#### Requirements

- Command workflow bodies originate from canonical `content/commands/*.md`.
- Every workflow is marked user-invocable and remains model-invocable unless a specific security/usability decision disables it.
- The generator must fail clearly on missing or malformed required canonical command content.
- DSH workflow metadata must not expose OpenCode-only `agent`, `model`, or `subtask` fields as if they had identical semantics.
- Agent/subtask hints must be expressed as explicit DSH workflow instructions or validated tool orchestration.
- Tracker placeholder resolution must use project-local Markdown by default. A host tracker integration may be added only after a DSH-native capability is verified.
- Workflows that create files, run commands, or commit must remain subject to the active DSH sandbox and approval policy.

#### Acceptance criteria

- Preparation produces all 17 generated workflow skills.
- Each workflow has stable name, description, valid frontmatter, and canonical body provenance.
- The DSH skill registry contains all enabled workflows after bundle activation.
- Representative interactive, autonomous, parallel, and artifact-producing workflows work in a DSH smoke profile.

### FR-2: Complete persona and specialist catalog

Generate persona metadata from all canonical agents.

#### Selectable primary presets

- `builder`
- `orchestrator`
- `planner`
- `ask`

The existing sidekick roles may be exposed as selectable only if that is appropriate for DSH users. Their required availability is as internal sidekick specialists.

#### Delegation specialists

- `coder`
- `architect`
- `critic`
- `feature-designer`
- `feature-reviewer`
- `security-reviewer`
- `local-context-gatherer`
- `external-context-gatherer`
- `sidekick-reviewer`
- `sidekick-security-reviewer`
- `sidekick-librarian`

#### Requirements

- Disabled source agents are not emitted as selectable or delegable.
- Canonical prompt bodies are used for every generated persona. The current hard-coded coder prompt must be removed.
- Every role has a stable identifier, source path, description, intent, and documented DSH tool policy.
- Primary personas are installed as system presets through the existing profile-patch architecture.
- Specialist personas may be generated as private templates rather than selectable presets when that is the safer DSH composition.

#### Acceptance criteria

- Generator tests cover all canonical agent definitions.
- The persona discovery tool reports every enabled primary and specialist role with its intended use.
- A disabled definition is absent.
- A malformed optional definition emits a diagnostic and does not stop unrelated roles.

### FR-3: Policy-aware specialist delegation

Replace the coder-only delegate tool with a role-aware delegation router.

#### Tool contract

`la_briguade_delegate` accepts:

```ts
{
  persona: string;
  task: string;
  mode?: "spawn" | "fork";
}
```

The implementation may expose narrower dedicated tools when this produces a better DSH model-facing contract, but it must keep validation centralized.

#### Requirements

- Validate persona membership, task length, task content, mode, and active parent agent.
- Use fresh `spawn` for independent tasks. Use `fork` only for documented workflows requiring parent context.
- Enforce a configurable maximum delegation depth with a secure default of one.
- Use an explicit, role-specific DSH tool filter; never inherit OpenCode permission maps.
- Child work must receive a cancellation signal and have guaranteed disposal on every result, rejection, startup failure, or cancellation path.
- Return a bounded result with role identity and a useful stop/failure reason.
- DSH delegated-child approval restrictions must remain intact; children must report blocked authority rather than retrying denied operations.

#### Baseline policy matrix

| Role | Default DSH tool policy |
|---|---|
| `coder` | Read, write, edit, grep, glob, bash, skill, subject to profile policy |
| `architect`, `critic`, `feature-reviewer`, `security-reviewer` | Read, grep, glob, skill |
| `feature-designer` | Read, grep, glob, skill |
| `local-context-gatherer` | Read, grep, glob, skill |
| `external-context-gatherer` | DSH web capability only when present and explicitly permitted |
| sidekick reviewers | Read, grep, glob, skill |
| sidekick librarian | Documentation-scoped edit policy, defined in FR-5 |

The baseline is deliberately conservative. Any added tool must be justified by a workflow and tested.

### FR-4: Model-route compatibility policy

Map source agent fields only to verified DSH capabilities.

| Source field | DSH policy |
|---|---|
| `model` | Map only after parsing a valid configured provider/model route. Otherwise retain the profile-selected route and emit a compatibility diagnostic. |
| `variant` | Map only to an adapter-supported DSH reasoning effort. |
| `maxSteps` | Do not map directly. Use DSH workflow, goal, and delegation bounds. |
| `temperature` | Apply only when the selected DSH provider explicitly supports it. |
| `top_p` | Do not map unless the targeted DSH provider/API explicitly supports it. |
| `color` | Presentation metadata only; no runtime behavior. |
| `mode` | Primary preset versus delegation-only specialist intent. |
| `disable` | Omit the persona/workflow route. |

#### Requirements

- Route policies are explicit adapter config, not hidden changes to a user's selected DSH model.
- Route and reasoning-effort selection must be validated against available DSH services/model catalog before use.
- Child model selection follows documented inheritance and override behavior.
- Unsupported values generate diagnostics that name the source definition but do not echo arbitrary untrusted values.

### FR-5: Persistent sidekick reviews

Replace `sidekick-agent`'s OpenCode process and session-list implementation with DSH continuable subagents.

#### Review modes

| Review mode | Specialist | Authority |
|---|---|---|
| `CODE_REVIEW` | `sidekick-reviewer` | Read-only repository review |
| `SECURITY_REVIEW` | `sidekick-security-reviewer` | Read-only repository/security review |
| `DOCUMENTATION_SYNC` | `sidekick-librarian` | Documentation-only editing policy |

#### Requirements

- A parent session and review mode identify one reusable DSH continuable child.
- `new_session: true` creates an unrelated child identity; default reuse resumes the existing compatible child.
- The implementation uses DSH child lifecycle APIs, not an OpenCode CLI subprocess.
- The parent receives bounded output and stable metadata describing whether work resumed or started fresh.
- A parent can interrupt a child and dispose it during parent teardown.
- Durable child/session identities and state must be managed through DSH's continuation/session facilities, not process-local maps alone.
- Documentation synchronization must be restricted to explicitly allowed documentation paths/content types; it must not mutate source code, manifests, schemas, generated files, or arbitrary assets.

### FR-6: Native reliability hooks

Port active runtime behavior through DSH-native interception points.

#### Edit error recovery

- Observe DSH post-tool execution.
- When the `edit` tool returns an equivalent old-string mismatch error, append a bounded reread hint as additional model context or feedback using the canonical DSH result path.
- Do not modify a successful edit result.

#### Empty response diagnostics

- Observe DSH agent/turn lifecycle rather than OpenCode `message.updated` events.
- Identify completed assistant attempts that produced no model-visible output.
- Emit a safe diagnostic through DSH logging and, only if a stable supported seam exists, a user-visible notification.
- Do not retry automatically until a separate retry policy is designed and tested.

#### Output retention

- First evaluate and configure DSH's output-retention/spill facilities.
- Do not revive the disabled OpenCode truncation function by default.
- If DSH retention is insufficient, add a bounded, source-preserving post-tool output policy with explicit observability and tests.

#### Requirements

- Hooks must preserve DSH result/source attribution and must not bypass sandbox or approval decisions.
- Hook failures are contained and logged; they must not terminate unrelated agent work.
- Each hook behavior has unit tests and a minimal real-composition test.

### FR-7: DSH content overrides and auto-injection

#### Content roots

DSH's ordinary skill providers, including project roots such as `.dsh/skills` and `.agents/skills`, remain supported. If la-briguade needs its own managed override roots, they must be explicit DSH settings and use documented precedence.

Initial target precedence:

```text
bundled la-briguade DSH content
< DSH global user content
< DSH project content
< explicitly enabled la-briguade DSH override content
```

The exact root locations must be finalized in Phase 0 and documented. OpenCode's five-layer content roots must not be read automatically.

#### Auto-inject behavior

- Reuse the current bounded file/content detection semantics where safe.
- Perform detection against the active DSH workspace/project root.
- Inject active content through scoped DSH system-prompt sections or pre-step context.
- Scope injections to intended personas.
- Use stable markers/identities so content is not injected twice.
- Enforce current size, traversal, symlink, recursion, and ignored-directory protections.
- `agents:` may select intended prompt recipients but must never grant DSH tool access.

### FR-8: Vendor prompts and model-specific prompt sections

- Generate or load vendor prompts from canonical source where available.
- Select prompt content based on the active DSH model route, not merely a static default.
- Add content as an ordered DSH system-prompt section scoped to the current agent/persona.
- Respect an explicit all-model fallback where source semantics define one.
- Avoid system prompt mutation that would leak content to unrelated agents or invalidate cache unnecessarily.
- Test assembly order, model changes, disabled prompts, and duplicate prevention.

### FR-9: MCP adapter

Use `@deepseek-ai/dsh-mcp-client` for compatible MCP tool servers.

#### Supported source mapping

| Source shape | DSH mapping |
|---|---|
| Local server | `transport: "stdio"` |
| `command: [program, ...args]` | `command: program`, `args: args` |
| Remote compatible server | `transport: "streamable-http"` |
| `{env:VAR_NAME}` in explicit env/header values | Resolve through a secret-safe adapter resolver |
| Tool namespace | DSH `mcp__<serverName>__<toolName>` |

#### Requirements

- MCP is disabled unless explicitly enabled in adapter/profile configuration.
- Accept only DSH-supported stdio and Streamable HTTP definitions.
- Reject legacy SSE-only remote definitions with a clear migration diagnostic.
- Validate server identifiers against DSH tool-name constraints before mounting.
- Translate argv without shell parsing or interpolation.
- Resolve environment tokens with the established security behavior:
  - no secret logging;
  - no generated secret artifacts;
  - missing optional environment values fail predictably;
  - resolved process arguments are validated for unsafe command characters where applicable.
- Let DSH's scrubbed environment remain the base; pass only explicitly configured additional environment variables.
- Validate headers and never serialize credentials into bundle source or diagnostics.
- Define collision behavior before mounting. Namespace conflicts must leave no partial registrations.
- Use DSH client lifecycle, reconnect, timeout, cancellation, and disposal behavior rather than recreating it.
- Scope MCP tool availability per persona through explicit DSH tool policy. No skill or source permission grants global access implicitly.
- Document that the DSH bridge is tool-focused; MCP Resources and Prompts are not claimed as supported.

#### Delivery sequence

1. Static adapter configuration for one local stdio server.
2. Multiple server names and collision tests.
3. Streamable HTTP configuration and header/env tests.
4. Persona-scoped access policy.
5. Optional skill-declared MCP mapping only after all preceding behavior is stable.

### FR-10: DSH configuration and diagnostics

#### Configuration

Introduce a DSH-specific validated configuration namespace. It includes only safe, portable options, initially:

```ts
type LaBriguadeDshConfig = {
  maxDelegationDepth?: number;
  enabledWorkflows?: string[];
  enabledPersonas?: string[];
  contentRoots?: string[];
  autoInject?: {
    enabled?: boolean;
    maxDepth?: number;
  };
  modelPolicies?: Record<string, unknown>;
  mcp?: Record<string, unknown>;
};
```

Final field schemas must be strict, bounded, and documented. Unknown, unsafe, or authority-bearing configuration must fail with actionable diagnostics rather than being ignored.

#### Diagnostics

Add a native `la_briguade_status` or `la_briguade_doctor` DSH tool that can safely report:

- adapter and DSH compatibility version;
- registered personas, workflows, skills, and optional feature status;
- disabled/malformed content counts and source paths;
- resolved non-secret configuration summary;
- MCP connection state and tool registration summary without credentials;
- remediation for missing services or incompatible profile configuration.

The tool must not expose environment values, prompt bodies, absolute paths beyond an approved diagnostic policy, or arbitrary configuration payloads.

## Implementation milestones

### M0 — Compatibility and design record

**Dependencies:** none.

- Verify DSH target version and public seams.
- Add a versioned compatibility test fixture.
- Finalize DSH configuration ownership and strict schema boundary.
- Update compatibility record and docs.

**Exit criteria:** exact target version, public APIs, and baseline smoke composition are recorded and passing.

### M1 — Canonical content generation

**Dependencies:** M0.

- Refactor `dsh/scripts/prepare.mjs` into validated generation steps.
- Generate all workflows and all agent persona artifacts from canonical content.
- Add source-to-generated manifest/provenance data.
- Add malformed/missing/disabled content diagnostics.

**Exit criteria:** all 17 workflows and all enabled roles are generated deterministically with tests.

### M2 — Delegation and model policy

**Dependencies:** M1.

- Implement specialist catalog and scoped delegation router.
- Remove hard-coded coder prompt.
- Implement safe model-route compatibility policy.
- Add child cancellation, disposal, depth, and tool-filter tests.

**Exit criteria:** every specialist can be invoked only through its documented DSH policy; unsupported model metadata is diagnosed.

### M3 — Workflow behavior validation

**Dependencies:** M1, M2.

- Validate workflow-specific orchestration routes.
- Implement custom DSH tools only where a generated prompt skill cannot provide the required deterministic orchestration.
- Cover parallel context gathering, review, refactor, handoff, and autonomous implementation paths.

**Exit criteria:** all commands are discoverable and representative workflows complete in a real DSH smoke profile.

### M4 — Hooks and persistent sidekick

**Dependencies:** M0, M2.

- Implement native edit-error and empty-response behavior.
- Evaluate output retention and add an adapter policy only if necessary.
- Implement continuable sidekick sessions and documentation-safe editing policy.

**Exit criteria:** no OpenCode CLI subprocess is used by the DSH sidekick; hook and lifecycle cleanup tests pass.

### M5 — Content policy and prompt behavior

**Dependencies:** M0, M1.

- Implement DSH-specific optional override loader.
- Port auto-inject detection and scoped prompt injection.
- Port vendor/model prompt sections.

**Exit criteria:** precedence, detection, prompt ordering, size limits, and no-authority-escalation tests pass.

### M6 — MCP adapter

**Dependencies:** M0, M2, M5.

- Implement static MCP mapping, lifecycle composition, and diagnostics.
- Add explicit persona-scoped MCP policies.
- Implement optional skill-origin mapping only after static behavior passes security review.

**Exit criteria:** supported stdio/HTTP fixtures, failure/reconnect/cancellation/cleanup tests, and secret-handling tests pass.

### M7 — Release hardening and migration

**Dependencies:** M1–M6.

- Add doctor/status capability.
- Complete capability matrix and migration documentation.
- Test package install, upgrade, reload, removal, and minimal profiles.
- Perform security audit and publication dry run.

**Exit criteria:** documentation accurately lists support boundaries; all release validation gates pass.

## Test strategy

### Unit and generator tests

- Canonical Markdown parsing and strict allowlisted metadata extraction.
- Deterministic generated workflow/persona artifacts.
- Disabled, malformed, oversized, unsafe, duplicate, and missing content handling.
- Command/agent identifier collision behavior.
- Config schema rejection of unsafe/unknown data.
- Delegation request validation, role policies, depth, cancellation, and disposal.
- Model mapping decisions.
- Prompt selection/injection ordering and duplication prevention.
- MCP source mapping, token resolution, validation, and no-secret diagnostics.

### Integration/composition tests

Use a minimal DSH composition with fake/recording providers where possible. Tests must not need production credentials or an external network.

- Register and invoke a generated workflow skill.
- Activate and use a generated primary preset.
- Start fresh and continuable subagents.
- Verify child tool restrictions and approval behavior.
- Observe hook behavior using actual tool/agent lifecycle events.
- Mount fixture MCP stdio and Streamable HTTP servers.
- Verify reload and disposal unregister tools and stop child work.

### Manual smoke tests

In the supported DSH Web/TUI profile:

1. Install the bundle from a local checkout.
2. Select `builder`, `orchestrator`, `planner`, and `ask`.
3. Invoke representative workflows from each category.
4. Delegate to a coding and a read-only specialist.
5. Start, resume, interrupt, and dispose a sidekick review.
6. Test a permitted and denied authority request.
7. Test a deliberately malformed optional skill/content item.
8. Test an MCP server lifecycle without logging its credentials.
9. Reload/remove the bundle and confirm cleanup.

### Required commands

For every implementation change:

```bash
npm run build
npm run build:dsh
npm run test:dsh
npm test
```

For config/schema-boundary changes:

```bash
npm run generate-schema
```

For release/security-sensitive milestones:

```bash
npm audit
npm_config_cache=/tmp/la-briguade-npm-cache npm pack --dry-run
```

## Documentation requirements

At each completed milestone, update:

- `DEEPSEEK.md` capability matrix and known limitations;
- `dsh/README.md` installation/configuration/support scope;
- root `README.md` DSH summary when user-visible capability changes;
- the compatibility decision record;
- `CHANGELOG.md` under Keep a Changelog headings when the project has release notes;
- source TSDoc for new exported DSH modules/functions.

Documentation must state both supported behavior and intentional differences from OpenCode. It must never imply that an OpenCode authority grant has been transferred to DSH.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| DSH pre-1.0 API changes | Exact-version compatibility fixture, pinned peer range, documented decision record. |
| Mechanical conversion broadens authority | Explicit DSH config, per-role tool policies, no permission import. |
| Prompt-only commands cannot enforce orchestration | Introduce small dedicated DSH tools only for truly deterministic lifecycle needs. |
| Model fields have different semantics | Map only verified provider-supported fields; diagnose the rest. |
| Dynamic prompt injection causes duplicates/cache churn | Stable section identities, route-aware assembly, bounded deterministic content. |
| Sidekick state leaks or survives incorrectly | Continuable lifecycle APIs, durable identities, explicit parent teardown tests. |
| MCP secrets leak | Token resolver tests, redacted diagnostics, scrubbed environment, no generated secrets. |
| Content override path attacks | Bounded reads, root validation, traversal/symlink checks, allowlisted metadata. |
| DSH profile lacks required services | Fail-fast startup diagnostics with remediation and minimal-profile smoke test. |

## Definition of done

The full DSH port is complete when:

1. All portable canonical agents, skills, commands, and workflows are discoverable and usable through DSH-native surfaces.
2. Every canonical specialist role has a documented, tested DSH delegation policy.
3. The persistent sidekick uses DSH continuable subagents, not OpenCode subprocesses.
4. Active OpenCode reliability behavior has a tested DSH-native equivalent or a documented host-provided replacement.
5. Content overrides, auto-injection, and route-specific prompts are safe, deterministic, bounded, and documented.
6. Compatible MCP servers can be explicitly configured and scoped without secret leakage or implicit authority expansion.
7. DSH-native diagnostics describe registration, compatibility, configuration, and optional-feature failures safely.
8. OpenCode build, tests, CLI, hooks, config layering, and package behavior remain unchanged.
9. All automated validation and manual smoke-test criteria pass against the recorded DSH target version.
10. `DEEPSEEK.md`, `dsh/README.md`, root `README.md`, and release documentation accurately state final support boundaries.
