# DeepSeek Harness Compatibility Spike Decision Record

**Validated against:** installed DeepSeek Harness `0.1.5-rc.2`.

## Decisions

1. **Packaging:** publish a dedicated `la-briguade-dsh` DSH profile bundle under `dsh/`.
   Its `dsh.bundle.patch` mounts the adapter and contributes an `agent-presets` system root.
   This keeps the OpenCode package entry point independent and lets users install with
   `dsh plugin --profile <profile> add la-briguade-dsh`.

2. **Skills:** register packaged Markdown skills through `ctx.skills.register()` with
   `source: "bundled"`. This uses the public `@deepseek-ai/dsh-skill` registry and avoids
   patching the host's filesystem-skill provider configuration. The DSH provider continues
   to supply `.dsh/skills` and `.agents/skills` overrides independently.

3. **Personas:** use DSH agent presets. The build preparation script derives four read-only
   system presets (`builder`, `orchestrator`, `planner`, `ask`) from the canonical agent
   Markdown and writes `preset.yml` plus `agent.cordis.yml` compositions using
   `@deepseek-ai/dsh-persona`. This is the DSH-native selectable-persona seam.

4. **Delegation:** expose a dedicated `la_briguade_delegate` tool. It starts a fresh `spawn`
   subagent via `ctx.subagents.start()` with a fixed coder persona, an explicit tool allowlist,
   a validated self-contained task, and a bounded maximum depth. It always disposes the run.

5. **Workflow:** derive OpenCode's `/just-do-it` prompt into the user-invocable DSH skill
   `la-briguade-just-do-it`. A workflow tool is deferred because DSH's own `workflow` tool is
   intended for model-authored JavaScript orchestration rather than a fixed slash-command prompt.

6. **Security:** OpenCode `permission`, `mcp`, `agents`, and `detect` frontmatter are never
   converted into DSH authority. DSH sandbox and approval settings remain profile-owned.

## Deferred items

- Porting commands beyond `/just-do-it`.
- Persistent sidekick sessions.
- Model-option mapping for OpenCode model/temperature/top-p/max-steps metadata.
- OpenCode output, edit-error, and empty-response hooks.
- A custom DSH Web client extension.
