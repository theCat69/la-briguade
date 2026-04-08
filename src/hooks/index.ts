import type { PluginInput, HooksResult } from "../types/plugin.js";

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

  const properties = event.properties as
    | { info?: { role?: string; time?: { completed?: number }; tokens?: { output?: number } } }
    | undefined;

  const info = properties?.info;
  if (info === undefined) return;
  if (info.role !== "assistant") return;
  if (info.time?.completed === undefined) return;

  // Message is completed — check if output is empty
  if (info.tokens?.output === 0) {
    console.warn(
      "[la-briguade] Empty assistant response detected — the model produced no output tokens.",
    );
  }
}
