import type { PluginInput, HooksResult } from "../types/plugin.js";
import { initNotifier, notifier } from "../utils/runtime/notifier.js";
import { isRecord } from "../utils/support/type-guards.js";

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
 *
 * @param ctx - Plugin context used to initialize the notifier
 * @param agentSections - Per-agent model-specific segments keyed by agent name.
 *   Invariant: config() must fully populate this map before any chat session begins —
 *   the system transform hook reads from it. Both config() and hooks are wired in the
 *   same Plugin call, so population always precedes hook execution.
 * @param vendorPrompts - Global vendor prompts keyed by model-family name (claude, gpt, etc.).
 *   Applied to ALL agents after any per-agent model section.
 */
export function createHooks(
  ctx: PluginInput,
): Partial<HooksResult> {
  initNotifier(ctx);

  return {
    "tool.execute.after": async (input, output) => {
      truncateLargeOutput(output);
      appendEditErrorHint(input.tool, output);
    },

    event: async ({ event }) => {
      detectEmptyResponse(event);
    }
  };
}

/**
 * Truncate tool output that exceeds the threshold.
 * Keeps the first HEAD_SIZE characters and last TAIL_SIZE characters
 * with a marker showing how many characters were removed.
 */
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

/**
 * When an edit tool call fails with a recognizable error, append a hint
 * suggesting the agent re-read the file before retrying.
 */
function appendEditErrorHint(
  toolName: string,
  output: { output?: unknown },
): void {
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

/**
 * On message.updated events, detect assistant messages that completed
 * with zero output tokens — a sign of a silent failure.
 */
function detectEmptyResponse(event: { type: string; properties?: unknown }): void {
  if (event.type !== "message.updated") return;

  const props = event.properties;
  if (!isRecord(props)) return;

  const messageInfo = props["info"];
  if (!isRecord(messageInfo)) return;

  const role = messageInfo["role"];
  if (role !== "assistant") return;

  const time = messageInfo["time"];
  if (!isRecord(time)) return;
  // Non-completed message updates omit the "completed" sentinel field.
  if (!("completed" in time)) return;

  const tokens = messageInfo["tokens"];
  if (!isRecord(tokens)) return;

  const output = tokens["output"];
  if (output === 0) {
    notifier.warn("Empty assistant response detected — the model produced no output tokens.");
  }
}
