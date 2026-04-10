compaction-guards.md
# Idea: Compaction Guards
## What
A hook on the `experimental.session.compacting` event that appends critical
context to the compaction prompt — ensuring that task state, active goals, and
key decisions survive the summary rather than being silently dropped.
## Why it matters
opencode's built-in compaction replaces the message history with a summary when
the session grows too long. For simple coding sessions this is fine. For
Orchestrator or Builder sessions that carry a complex multi-step plan, a
naive summary can lose the exact information that makes the rest of the session
coherent: which tasks are in progress, which agents have been invoked, what
decisions were made and why.
oh-my-openagent ships compaction guards specifically to protect orchestration
state. la-briguade exposes the right agents (Orchestrator, Builder, Planner)
but does nothing to protect their state across compaction events.
## Surface area
- `src/hooks/index.ts` — the `experimental.session.compacting` hook already
  exists in the opencode plugin API (`output.context` for appending,
  `output.prompt` for full replacement)
- Possibly agent-specific: guards may only make sense for `primary` mode agents
  like Orchestrator and Builder, not for short-lived subagents
## Open questions
- What content is worth preserving unconditionally? (active task list, current
  workflow step, agent delegation state?)
- Should the guard be a static template, or should it try to extract structured
  state from the session dynamically?
- Is per-agent guard content the right model, or a single shared guard for all
  primary agents?
- Risk of over-stuffing: if the guard itself is too large it defeats the purpose
  of compaction — what's the right size budget?
