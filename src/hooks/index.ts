import type { PluginInput, HooksResult } from "../types/plugin.js";

/**
 * Invariant: HEAD_SIZE + TAIL_SIZE must be ≤ TRUNCATION_THRESHOLD.
 * If the sum exceeds the threshold, the truncated output would be
 * larger than the original — defeating the purpose of truncation.
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

/**
 * Truncate tool output that exceeds the threshold.
 * Keeps the first HEAD_SIZE characters and last TAIL_SIZE characters
 * with a marker showing how many characters were removed.
 */
function truncateLargeOutput(output: { output: string }): void {
  if (output.output.length <= TRUNCATION_THRESHOLD) return;

  const originalLength = output.output.length;
  const removedChars = originalLength - HEAD_SIZE - TAIL_SIZE;

  output.output =
    output.output.slice(0, HEAD_SIZE) +
    `\n\n[truncated ${removedChars} chars]\n\n` +
    output.output.slice(originalLength - TAIL_SIZE);
}

/**
 * When an edit tool call fails with a recognizable error, append a hint
 * suggesting the agent re-read the file before retrying.
 */
function appendEditErrorHint(
  toolName: string,
  output: { output: string },
): void {
  if (toolName !== "edit") return;

  const hasEditError = EDIT_ERROR_PATTERNS.some((pattern) =>
    output.output.includes(pattern),
  );

  if (hasEditError) {
    output.output +=
      "\nHint: Re-read the file to get current content before retrying the edit.";
  }
}

/**
 * On message.updated events, detect assistant messages that completed
 * with zero output tokens — a sign of a silent failure.
 */
function detectEmptyResponse(event: { type: string; properties?: unknown }): void {
  if (event.type !== "message.updated") return;

  const props = event.properties;
  if (props == null || typeof props !== "object") return;

  const info = "info" in props ? props.info : undefined;
  if (info == null || typeof info !== "object") return;

  const role = "role" in info ? info.role : undefined;
  if (role !== "assistant") return;

  const time = "time" in info ? info.time : undefined;
  if (time == null || typeof time !== "object") return;
  if (!("completed" in time) || time.completed === undefined) return;

  const tokens = "tokens" in info ? info.tokens : undefined;
  if (tokens == null || typeof tokens !== "object") return;

  const output = "output" in tokens ? tokens.output : undefined;
  if (output === 0) {
    console.warn(
      "[la-briguade] Empty assistant response detected — the model produced no output tokens.",
    );
  }
}
