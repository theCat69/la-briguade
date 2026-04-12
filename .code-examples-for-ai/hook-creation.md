<!-- Pattern: hook-creation — Creating tool.execute.after, tool.execute.before, chat.params and event hooks with output truncation logic -->

```typescript
// src/hooks/index.ts — createHooks() returns Partial<HooksResult> to be spread into the plugin return.
// Key points to imitate:
//   1. Return type is Partial<HooksResult> — not the full object, not a class
//   2. Hook handlers are async functions that mutate the output object in-place
//   3. Extract each concern into a named private helper (not anonymous inline logic)
//   4. Use as const for string literal arrays to get narrow types
//   5. Document size invariants as comments (HEAD_SIZE + TAIL_SIZE ≤ TRUNCATION_THRESHOLD)
//   6. output.output is typed as `output?: unknown` — guard with typeof !== "string" before any string
//      operations; MCP tool responses may carry non-string (e.g. object) payloads and must pass through
//   7. Use chat.params to track per-session state (e.g. agent name), clean up on session.deleted
//   8. Use tool.execute.before to gate tool calls before they run (mutate output.args to block)

import type { PluginInput, HooksResult } from "../types/plugin.js";

/**
 * Invariant: HEAD_SIZE + TAIL_SIZE must be ≤ TRUNCATION_THRESHOLD.
 */
const TRUNCATION_THRESHOLD = 50_000;
const HEAD_SIZE = 25_000;
const TAIL_SIZE = 10_000;

const EDIT_ERROR_PATTERNS = [
  "oldString not found",
  "Found multiple matches for oldString",
] as const;

/**
 * Build the plugin hooks object (event, tool.execute.after, etc.).
 * Returns a partial Hooks object to be spread into the plugin return value.
 *
 * @param agentSkillPerms - Per-agent permission.skill map extracted from agent frontmatter.
 *   Passed in as a ReadonlyMap so the hook set cannot mutate it.
 */
export function createHooks(
  _ctx: PluginInput,
  agentSkillPerms: ReadonlyMap<string, Record<string, string>>,
): Partial<HooksResult> {
  // Tracks which agent is active for each live session ID.
  // Populated by chat.params, cleaned up by session.deleted in the event hook.
  const sessionAgentMap = new Map<string, string>();

  return {
    // Capture the active agent name per session before any tool calls are made.
    "chat.params": async (input) => {
      sessionAgentMap.set(input.sessionID, input.agent);
    },

    // Gate skill tool calls according to the agent's permission.skill policy.
    // Mutate output.args.name to "" to effectively block the call.
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "skill") return;
      const agentName = sessionAgentMap.get(input.sessionID);
      if (agentName === undefined) return;
      const perms = agentSkillPerms.get(agentName);
      if (perms === undefined || perms["*"] !== "deny") return;
      const args = output.args as Record<string, unknown>;
      const skillName = typeof args["name"] === "string" ? args["name"] : "";
      if (perms[skillName] !== "allow" && perms[skillName] !== "ask") {
        output.args = { ...args, name: "" }; // block: empty name is rejected by the skill tool
      }
    },

    "tool.execute.after": async (_input, output) => {
      truncateLargeOutput(output);
      appendEditErrorHint(_input.tool, output);
    },

    event: async ({ event }) => {
      detectEmptyResponse(event);
      // Clean up session state on deletion to prevent unbounded map growth.
      if (event.type === "session.deleted") {
        const info = (event.properties as Record<string, unknown>)?.["info"];
        const id = (info as Record<string, unknown>)?.["id"];
        if (typeof id === "string") sessionAgentMap.delete(id);
      }
    },
  };
}

// output.output is typed as `output?: unknown` — always guard before string ops.
// MCP tool responses may carry non-string payloads; the guard makes them pass through silently.
function truncateLargeOutput(output: { output?: unknown }): void {
  if (typeof output.output !== "string") return;
  const current = output.output;

  if (current.length <= TRUNCATION_THRESHOLD) return;

  const originalLength = current.length;
  const removedChars = originalLength - HEAD_SIZE - TAIL_SIZE;

  output.output =
    current.slice(0, HEAD_SIZE) +
    `\n\n[truncated ${removedChars} chars]\n\n` +
    current.slice(originalLength - TAIL_SIZE);
}

function appendEditErrorHint(toolName: string, output: { output?: unknown }): void {
  if (toolName !== "edit") return;
  if (typeof output.output !== "string") return;
  const current = output.output;

  const hasEditError = EDIT_ERROR_PATTERNS.some((pattern) =>
    current.includes(pattern),
  );

  if (hasEditError) {
    output.output =
      current +
      "\nHint: Re-read the file to get current content before retrying the edit.";
  }
}
```
