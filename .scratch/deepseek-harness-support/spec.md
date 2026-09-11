# Native DeepSeek Harness Support for la-briguade

## Problem Statement

`la-briguade` is currently an OpenCode-only runtime plugin. Its entry point imports
`@opencode-ai/plugin`, mutates an OpenCode configuration object to register agents,
skills, commands, MCP servers, and permissions, and uses OpenCode hook/event contracts
for output-management behavior. DeepSeek Harness (DSH) has an incompatible plugin model:
DSH packages are native Cordis-style service plugins, installed in a DSH profile, with
separate service, tool, skill, persona, and client-extension seams.

Users who work in DSH therefore cannot use la-briguade's engineering-team content,
orchestration workflows, skill guidance, and workflow safeguards without manually
recreating them. Loading the existing OpenCode plugin in DSH is explicitly not viable:
its public API, configuration schema, event lifecycle, and permission model are specific
to OpenCode.

The project needs native DSH support that reuses la-briguade's canonical Markdown content
where practical, preserves the existing OpenCode experience, follows DSH-native security
and lifecycle contracts, and establishes a maintainable path for future feature parity.

## Solution

Add DSH support as a separate, native runtime adapter in the same repository and publish it
as a separately addressable DSH plugin package or package export. Retain the current
OpenCode plugin entry point and behavior unchanged except for extracting genuinely
runtime-neutral parsing and content-model code.

The first release is a deliberately scoped MVP. It must expose the high-value engineering
team experience in DSH through:

1. la-briguade skills discoverable in DSH;
2. selectable primary personas for `builder`, `orchestrator`, `planner`, and `ask`;
3. delegation to la-briguade specialist personas, beginning with `coder`;
4. one user-invocable implementation workflow derived from `/just-do-it`; and
5. documented installation, configuration, compatibility, and known limitations.

The MVP must not attempt a mechanical copy of all 17 OpenCode commands, the OpenCode hook
set, or the persistent `sidekick-agent` tool. Each will be assessed and implemented only
at an appropriate DSH service seam after the core adapter is validated.

The DSH adapter will use DSH's native mechanisms:

- a Cordis-compatible `apply(ctx, config)` package entry point;
- DSH skill discovery/provisioning for the Markdown skill catalog;
- DSH persona/agent configuration for primary and delegated roles;
- DSH subagent providers and DSH-facing tools for delegation and workflows; and
- DSH sandbox/tool policies for authority rather than importing OpenCode permission maps.

## User Stories

1. **Install native support.** As a DSH user, I can install la-briguade into my chosen DSH
   profile using the documented DSH profile-plugin workflow, without installing or
   configuring OpenCode.

   **Acceptance criteria**
   - The published artifact has a documented DSH installation command.
   - A successful installation makes the plugin visible to the selected DSH profile.
   - Installation does not write OpenCode configuration or require
     `@opencode-ai/plugin` at DSH runtime.

2. **Use la-briguade skills in DSH.** As a DSH user, I can see and load selected
   la-briguade skills from the normal DSH skill catalog.

   **Acceptance criteria**
   - Every enabled MVP skill has valid DSH-compatible frontmatter containing at least
     `name` and `description`.
   - The skill body loaded by DSH is the canonical maintained Markdown body, not a
     copied divergent version.
   - A user can override or extend skills using documented DSH-supported roots.
   - Invalid skill frontmatter is reported through actionable diagnostics and does not
     prevent other valid skills from loading.

3. **Select a primary engineering persona.** As a DSH user, I can start work with a
   `builder`, `orchestrator`, `planner`, or `ask` persona and receive the relevant
   la-briguade system guidance.

   **Acceptance criteria**
   - Each MVP persona has a stable identifier, display name/description, and source
     content mapping.
   - The persona receives its applicable agent prompt, model policy, and allowed tool
     profile through DSH-native configuration.
   - A disabled source agent is not exposed as selectable.
   - Unsupported OpenCode-only frontmatter is either mapped deliberately or surfaced as
     an adapter validation warning; it is never silently interpreted with changed meaning.

4. **Delegate to a specialist.** As an orchestrating DSH persona, I can delegate a
   self-contained implementation task to the `coder` specialist and receive its final
   result.

   **Acceptance criteria**
   - The delegation has an explicit maximum nesting depth.
   - The child receives the intended `coder` persona and explicitly scoped tools.
   - The parent receives a bounded final result or a useful failure result.
   - Cancellation, refusal, and child startup failures do not leave an orphaned active
     subagent session.

5. **Run an implementation workflow.** As a DSH user, I can invoke an initial
   implementation workflow based on `/just-do-it` without needing to reproduce a long
   prompt manually.

   **Acceptance criteria**
   - The workflow is user-invocable from a DSH-supported surface.
   - Its required inputs and expected output are documented.
   - The workflow delegates only to personas and tools enabled by the active DSH profile.
   - The workflow can produce a plan, implementation work, validation results, and a
     concise completion or blocker report.

6. **Preserve OpenCode behavior.** As an existing OpenCode user, I continue to install
   and use la-briguade through the current OpenCode plugin/CLI flow.

   **Acceptance criteria**
   - The existing default package export remains the OpenCode plugin contract.
   - Existing OpenCode config layering, user overrides, commands, skills, MCP collection,
     permission injection, and hooks retain their observable behavior.
   - OpenCode tests and build checks remain green after shared-code extraction.

7. **Configure safely.** As an administrator, I can configure the DSH adapter without
   unintentionally granting shell, filesystem, network, or MCP authority.

   **Acceptance criteria**
   - The adapter has an explicit runtime-validated configuration schema.
   - All optional authority-bearing capabilities are opt-in and documented.
   - A source skill's OpenCode `permission`, `mcp`, `agents`, or `detect` frontmatter does
     not automatically grant an equivalent DSH capability.
   - Invalid, unknown, or unsafe configuration values fail predictably with a diagnostic.

8. **Understand support boundaries.** As a user or maintainer, I can determine what is
   available in the DSH MVP, what remains OpenCode-only, and how to report compatibility
   issues.

   **Acceptance criteria**
   - Documentation contains a capability matrix for DSH and OpenCode.
   - Documentation lists the exact DSH version range used for validation.
   - Documentation identifies unsupported features and the intended follow-up phase.

9. **Use project-local content.** As a team, I can add DSH-compatible project-local skills
   without modifying the installed la-briguade package.

   **Acceptance criteria**
   - The adapter documents the supported DSH roots, including `.dsh/skills` and
     `.agents/skills` where provided by DSH.
   - Precedence between bundled la-briguade skills and DSH project/user overrides is
     deterministic and documented.
   - Override behavior is covered by integration tests.

10. **Diagnose a failed startup.** As a user, I receive enough information to fix a DSH
    adapter startup failure rather than an opaque missing-feature error.

    **Acceptance criteria**
    - Missing required DSH services or subagent providers identify the missing dependency
      and the required configuration.
    - Incompatible DSH versions and malformed persona/content definitions are reported
      with the affected source identifier.
    - Non-fatal failures in one optional content item do not disable the full adapter.

## Implementation Decisions

### Product and packaging boundaries

- DSH support is a first-class native integration, not an OpenCode compatibility wrapper.
- The current `src/index.ts` remains the OpenCode entry point and must not import DSH
  packages.
- The DSH implementation lives in a DSH-specific source boundary and must not require
  OpenCode runtime dependencies.
- Shared modules may contain only runtime-neutral concerns: bounded content reading,
  YAML/frontmatter parsing, source validation, canonical identifiers, and normalized
  content data. Runtime registration, hooks, permissions, tools, model routing, and
  lifecycle code remain adapter-specific.
- The publishing design must provide unambiguous OpenCode and DSH entry points. The
  implementation spike will choose between a dedicated `la-briguade-dsh` package in this
  repository or a DSH-specific package export, based on DSH profile-loader requirements.
  This is a release/packaging decision, not a reason to couple runtime code.

### Content model and compatibility mapping

- Markdown under `content/` remains canonical unless a deliberate DSH-only companion
  artifact is required because the two runtimes have different semantics.
- Agent definitions are normalized into a neutral representation that preserves:
  identifier, description, prompt body, primary/subagent intent, model hints, and disabled
  state. Their OpenCode registration remains unchanged.
- DSH maps the normalized agent definition to a persona/agent preset. It must explicitly
  define behavior for every currently consumed agent frontmatter field:

  | Source field | DSH adapter policy |
  |---|---|
  | `description` | Persona catalog description. |
  | `mode` | Maps to selectable primary persona versus delegation-only specialist intent. |
  | `model`, `temperature`, `top_p`, `maxSteps` | Map only after confirming an equivalent DSH route/options API; otherwise reject or ignore with a visible compatibility diagnostic. |
  | `disable` | Prevents exposure in DSH. |
  | `variant`, `color` | Presentation metadata only when a DSH equivalent exists; otherwise ignored with documented behavior. |
  | `permission` | Never copied. Replaced with DSH-native, least-privilege tool policy. |

- Existing `SKILL.md` body content remains shared. DSH-compatible fields (`name`,
  `description`, optionally `whenToUse`, `user-invocable`, and
  `disable-model-invocation`) become the canonical minimum skill contract.
- OpenCode-only skill fields (`mcp`, `permission`, `agents`, and `detect`) remain supported
  by the OpenCode adapter. The DSH adapter must treat them as untrusted/non-authoritative
  metadata until an explicit DSH mapping is designed and tested.
- Existing OpenCode command Markdown is not assumed to be directly consumable by DSH.
  Commands are classified as either an instruction-only user-invocable DSH skill or a
  typed DSH tool/workflow. `/just-do-it` is the only initial command selected for porting.
- The OpenCode placeholder `{{TRACKER_CONFIGURATION}}` must be resolved by a
  runtime-neutral template resolver only if DSH has an equivalent configured tracker
  service. Otherwise the DSH workflow must explicitly use project-local Markdown output.

### DSH runtime composition

- The adapter's package entry follows DSH's native plugin contract: exported package name,
  dependency injection declaration, validated configuration schema, and
  `apply(ctx, config)` registration function.
- The adapter declares and validates the DSH services it depends on. Required services for
  the MVP include the relevant agent/persona, skill, tool, and subagent services; exact
  package names and contracts are pinned during the compatibility spike.
- Fresh subagent delegation is the default MVP transport because specialist work is
  designed to receive a self-contained task. A fork/continuation provider may be added
  only for workflows that demonstrably require the parent transcript.
- DSH subagent depth must be bounded and configurable with a secure default.
- Delegated tool availability is an explicit allowlist per specialist role. It is never
  inherited implicitly from source OpenCode permissions.
- A client/UI extension is not part of the MVP. The plugin must work in the standard DSH
  TUI/Web runtime using existing DSH surfaces. Any future client package is separately
  versioned and declared through DSH's client-injection manifest.

### Configuration and content roots

- DSH configuration is distinct from `la-briguade.jsonc`, whose schema and semantics are
  OpenCode-oriented today. The MVP introduces a separate validated DSH configuration
  namespace/schema instead of overloading unsupported fields.
- The DSH adapter uses DSH's standard skill discovery roots and may configure a bundled
  la-briguade skill root. It documents all root precedence behavior.
- Existing OpenCode override directories retain their current behavior and are not treated
  as DSH override roots unless a later explicit migration setting is introduced.
- All filesystem paths, package content roots, identifiers, and configuration-provided
  directories require boundary validation. Path traversal, symlink escapes, prototype
  pollution keys, and unbounded content reads must be rejected or safely skipped with
  diagnostics.

### Hooks, safety, and deferred parity

- OpenCode hooks are not ported mechanically. Each behavior must be evaluated against DSH
  capabilities and replaced only at a DSH-native seam.
- The initial DSH adapter does not include output truncation, edit-error recovery,
  empty-response detection, model-section injection, vendor-prompt injection, OpenCode
  skill access gating, or the persistent `sidekick-agent` tool.
- Vendor prompt behavior, if later retained, is modeled as a documented DSH persona/prompt
  policy with scoped application. It must not mutate global prompts unexpectedly.
- Persistent sidekick support is a later phase and requires DSH continuable subagents,
  isolated session routing by review type, bounded output, cancellation behavior, and
  tests for state cleanup.

### Observability and errors

- The adapter emits actionable diagnostics for content parse failures, unsupported mappings,
  missing services, blocked subagent starts, and invalid configuration.
- Diagnostics must include a safe source identifier and must not log credentials, complete
  prompts unnecessarily, or untrusted raw configuration values.
- Optional content failures are isolated. Required plugin startup failures fail fast with a
  remediation message.

### Versioning

- DSH is currently pre-1.0 in the environment used for discovery. The package must pin a
  tested compatible range and treat DSH API changes as a compatibility boundary.
- The MVP release notes state that DSH support is additive and may initially be marked
  experimental until compatibility tests run against a stable DSH release line.

## Testing Decisions

### Test seams

The implementation must create small, observable seams rather than testing DSH internals.

1. **Normalized content loader**
   - Given agent and skill Markdown, it produces normalized valid definitions.
   - It preserves valid canonical bodies and rejects malformed, oversized, unsafe, or
     unsupported frontmatter deterministically.
   - It continues loading other content after an optional item fails.

2. **Source-to-DSH mapping**
   - Given a normalized agent definition, it yields the expected DSH persona configuration
     or a documented compatibility diagnostic.
   - Tests cover every consumed OpenCode agent field and the explicit no-copy rule for
     `permission`.

3. **Skill provider/root resolution**
   - Given bundled, project, custom, and user roots, DSH sees the expected skill catalog
     and deterministic winner for duplicate names.
   - Tests cover valid directory bundles, flat files when supported, invalid frontmatter,
     missing roots, and project-local overrides.

4. **Persona catalog and tool policy**
   - The four MVP primary personas are selectable.
   - The `coder` persona is delegation-only unless deliberately configured otherwise.
   - Disabled agents are absent.
   - Each persona's tool allowlist is verified, especially absence of unapproved authority.

5. **Delegation workflow**
   - A minimal DSH test composition starts a fresh `coder` child, supplies its persona and
     task, returns the final result, enforces depth, and cleans up cancellation/error paths.
   - The test uses a fake/recording LLM and subagent backend where available; no production
     credentials or network calls are required.

6. **User-invocable workflow**
   - The `/just-do-it` replacement exposes correct metadata and validates inputs.
   - It routes through only enabled DSH services and returns a stable success/blocker
     contract.

7. **Regression coverage**
   - Existing OpenCode unit tests remain unchanged where possible and continue to pass.
   - New shared loader tests prove behavior did not change for OpenCode content loading.
   - `npm run build`, `npm test`, and `npm run generate-schema` run for any change touching
     the current package/schema boundary. DSH package build and tests run independently.

### Validation environments

- Validate the DSH adapter first against the exact installed DSH version used by the
  compatibility spike, then add a declared compatible range once the published package
  arrangement is settled.
- Perform a manual smoke test in the existing DSH Web/TUI profile: install, start a
  `builder` persona, load a skill, delegate to `coder`, invoke the implementation workflow,
  and inspect diagnostics for a deliberately malformed optional skill.
- Test without network and without optional MCP servers to confirm the base plugin starts
  safely in a minimal profile.

## Out of Scope

- Replacing, removing, or redesigning the existing OpenCode plugin.
- Executing `src/index.ts` or any other OpenCode runtime registration code inside DSH.
- Full parity for all 17 OpenCode slash commands in the first DSH release.
- Porting OpenCode hook implementations verbatim.
- Automatic conversion of OpenCode permission, MCP, shell, external-directory, or agent
  opt-in grants into DSH authority.
- A custom DSH graphical client plugin, sidebar, or settings UI.
- Persistent sidekick reviews and cross-session review reuse.
- A generic OpenCode-to-DSH plugin compatibility layer.
- Publishing a DSH adapter before the API/version compatibility spike and security policy
  mapping are complete.

## Further Notes

### Milestones

1. **Compatibility spike**
   - Verify the current DSH package/plugin loader contract, persona/agent registration
     seam, skill provider seam, tool schema system, and fresh/continuable subagent APIs.
   - Decide the DSH publishing shape: dedicated package versus package export.
   - Produce a short API decision record listing the pinned DSH versions and verified
     integration points.

2. **Shared content boundary**
   - Extract only the parsing/model pieces that both adapters can safely share.
   - Keep OpenCode observable behavior covered by regression tests.

3. **DSH skills and personas**
   - Ship valid DSH skill exposure and the four primary personas.
   - Implement safe override/root precedence and diagnostics.

4. **Delegation and initial workflow**
   - Add the `coder` subagent route and the `/just-do-it` replacement.
   - Add fake-composition and smoke tests.

5. **Documentation and experimental release**
   - Publish installation/configuration instructions, capability matrix, security model,
     migration/override guidance, and limitations.
   - Mark the support level accurately based on DSH release stability.

6. **Post-MVP parity evaluation**
   - Prioritize additional commands from user demand and measure which hook behaviors are
     still needed in DSH.
   - Design persistent sidekick support only after DSH continuation/session semantics are
     confirmed.

### Open questions to resolve during the compatibility spike

- Which exact DSH package/service owns selectable personas in the targeted DSH release?
- Does the DSH profile plugin loader support multiple exports from one npm package reliably,
  or should the adapter be published as `la-briguade-dsh`?
- What is the supported way to make a workflow explicitly user-invocable in DSH?
- Which DSH model-route fields are semantically equivalent to OpenCode's `model`,
  `temperature`, `top_p`, and `maxSteps`?
- What built-in DSH mechanisms already cover output bounds, tool errors, and empty assistant
  responses, so duplicate policy code can be avoided?
- Does DSH expose a tracker integration suitable for resolving the existing tracker
  placeholder, or should initial DSH workflows always generate project-local Markdown?
- What package/version constraints are appropriate once DSH reaches a stable public API?

After approval, use `/to-tickets` or an equivalent implementation backlog to split these
milestones into independently deliverable tickets. Do not begin code changes until the
compatibility-spike decisions are recorded.
