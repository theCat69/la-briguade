<!-- Pattern: hook-creation — Creating tool.execute.after and event hooks with output truncation logic -->

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
 */
export function createHooks(_ctx: PluginInput): Partial<HooksResult> {
  return {
    "tool.execute.after": async (_input, output) => {
      truncateLargeOutput(output);
      appendEditErrorHint(_input.tool, output);
    },

    event: async ({ event }) => {
      detectEmptyResponse(event);
    },
  };
}

// output.output is typed as `output?: unknown` — always guard before string ops.
// MCP tool responses may carry non-string payloads; the guard makes them pass through silently.
function truncateLargeOutput(output: { output?: unknown }): void {
  if (typeof output.output !== "string") return;
  const current = output as { output: string };

  if (current.output.length <= TRUNCATION_THRESHOLD) return;

  const originalLength = current.output.length;
  const removedChars = originalLength - HEAD_SIZE - TAIL_SIZE;

  current.output =
    current.output.slice(0, HEAD_SIZE) +
    `\n\n[truncated ${removedChars} chars]\n\n` +
    current.output.slice(originalLength - TAIL_SIZE);
}

function appendEditErrorHint(toolName: string, output: { output?: unknown }): void {
  if (toolName !== "edit") return;
  if (typeof output.output !== "string") return;
  const current = output as { output: string };

  const hasEditError = EDIT_ERROR_PATTERNS.some((pattern) =>
    current.output.includes(pattern),
  );

  if (hasEditError) {
    current.output =
      current.output +
      "\nHint: Re-read the file to get current content before retrying the edit.";
  }
}
```
