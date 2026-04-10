context-window-pressure-monitor.md
# Idea: Context-Window Pressure Monitor
## What
A hook that tracks how full the context window is getting during a session and
proactively signals agents — or the user — when they are approaching saturation.
Rather than waiting for silent failures or truncated responses, the plugin would
emit a visible warning at a configurable threshold.
## Why it matters
Long Orchestrator and Builder sessions are the most likely to silently degrade:
the agent starts losing earlier instructions, decisions, or task state without
any indication that anything is wrong. By the time a failure surfaces it can be
hard to trace back to context pressure. An early warning gives the agent (and
the user) a chance to summarize, handoff, or compact before quality drops.
oh-my-openagent ships ~51 hooks including a context-window monitor for exactly
this reason. la-briguade currently has no awareness of session length or context
saturation.
## Surface area
- `src/hooks/index.ts` — likely an `event` hook tracking message counts or
  output token accumulation as a proxy for context pressure
- The `experimental.session.compacting` hook may also be relevant as a
  complementary signal
## Open questions
- Does the opencode plugin API expose token counts or context usage metrics in
  any event payload? (needs verification — if not, a message-count proxy may be
  the only option)
- What is the right threshold? Should it be configurable via `la-briguade.jsonc`?
- Should the signal be injected into the system prompt, emitted as a user-visible
  message, or both?
- Is this per-agent (Orchestrator vs coder thresholds) or global?
