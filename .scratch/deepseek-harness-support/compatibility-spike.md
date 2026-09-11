# DeepSeek Harness Compatibility Decision Record

**Adapter baseline:** DSH package family `0.1.5-rc.2`.

## Verified public seams

The installed package typings for `0.1.5-rc.2` verify:

1. Cordis plugins use `name`, `inject`, `Config`, and `apply(ctx, config)`; `ctx.plugin()` owns
   nested plugin lifecycle.
2. `ctx.skills.register()` and `ctx.tools.register()` return effect disposers.
3. `ctx.subagents.start(provider, request)` supports a child persona, tool filter, maximum depth,
   cancellation signal, and an owned run disposer. Provider names `spawn` and `fork` are supplied
   by their respective standard DSH compositions.
4. `ctx.subagents.startContinuable()`, `sendMessage()`, `interrupt()`, and
   `drainContinuableChildren()` provide durable sidekick lifecycle behavior.
5. DSH exposes `tools/post-execute` as a result waterfall and `tools/result` as a final observer.
6. `@deepseek-ai/dsh-mcp-client` supports one stdio or Streamable HTTP server per plugin instance,
   with qualified `mcp__<server>__<tool>` names and disposal-managed connection cleanup.
7. System-prompt sections are supplied by `ctx.systemPrompt.section()` when the profile composes
   the system-prompt service.

The top-level local DSH launcher package previously reported `0.1.5-rc.1`, while the inspected
component package family reports `0.1.5-rc.2`. Consumers must pin the complete profile package
family rather than infer compatibility from the launcher alone.

## Adapter decisions

- The DSH bundle remains separately packageable under `dsh/`; OpenCode runtime code remains
  untouched.
- Canonical commands and agent prompt bodies are generated into a manifest, workflow skills,
  specialist prompt files, and primary-preset compositions. The generated manifest retains source
  provenance but does not transfer source permissions.
- All specialist children use explicit role policies. No OpenCode permission map is inherited.
- DSH model-route selection remains profile-owned. Source model metadata is currently ignored;
  no provider-specific mapping or compatibility diagnostic is installed yet.
- Sidekick reviews use DSH continuable children; no OpenCode CLI process/session lookup is used.
- MCP requires explicit DSH configuration and accepts only native stdio and Streamable HTTP tools.
  Secret tokens resolve only in memory and are not reported in diagnostics.
- Output truncation remains host-provided because the source OpenCode truncation hook was disabled.

## Validation record

- `npm run build:dsh`
- `npm run test:dsh`
- DSH static import and recording-registry composition smoke test
