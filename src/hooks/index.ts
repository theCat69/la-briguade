import type { PluginInput, HooksResult } from "../types/plugin.js";
import { resolveModelSection, KNOWN_FAMILIES, type ModelFamily } from "../utils/model-sections.js";

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

/** Per-agent entry holding both the base prompt text and per-family sections. */
export type AgentSectionsEntry = {
  base: string;
  sections: Partial<Record<ModelFamily, string>>;
};

/**
 * Build the plugin hooks object (event, tool.execute.after, etc.).
 * Returns a partial Hooks object to be spread into the plugin return value.
 *
 * @param _ctx - Plugin context (reserved for future use)
 * @param agentSections - Per-agent model-specific sections keyed by agent name.
 *   Invariant: config() must fully populate this map before any chat session begins —
 *   the system transform hook reads from it. Both config() and hooks are wired in the
 *   same Plugin call, so population always precedes hook execution.
 * @param vendorPrompts - Global vendor prompts keyed by model-family name (claude, gpt, etc.).
 *   Applied to ALL agents after any per-agent model section.
 */
export function createHooks(
  _ctx: PluginInput,
  agentSections: Map<string, AgentSectionsEntry>,
  vendorPrompts: Map<string, string>,
): Partial<HooksResult> {
  return {
    "tool.execute.after": async (_input, output) => {
      truncateLargeOutput(output);
      appendEditErrorHint(_input.tool, output);
    },

    event: async ({ event }) => {
      detectEmptyResponse(event);
    },

    "experimental.chat.system.transform": async (input, output) => {
      // Safe access: id may be absent on unexpected model shapes
      const modelId = input.model?.id?.toLowerCase() ?? "";
      injectModelSections(agentSections, modelId, output.system);
      injectVendorPrompts(agentSections, vendorPrompts, modelId, output.system);
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
 * For each system prompt string, check if it matches a known agent base prompt.
 * If a match is found, append the best-matching model-family section to that string.
 *
 * Matching strategy (KNOWN_FAMILIES order, then claude fallback):
 * 1. Iterate families in order — first family whose name appears in `modelId` wins
 * 2. Fall back to the `claude` section if no direct match
 * 3. If neither, leave the system string unchanged
 */
function injectModelSections(
  agentSections: Map<string, AgentSectionsEntry>,
  modelId: string,
  system: string[],
): void {
  // Fast-path: nothing registered, skip all iteration
  if (agentSections.size === 0) return;

  forEachMatchedSystemEntry(agentSections, system, (idx, entry) => {
    const match = resolveModelSection(entry.sections, modelId);
    if (match === undefined) return;

    system[idx] = `${system[idx]!}\n\n${match}`;
  });
}

function forEachMatchedSystemEntry(
  agentSections: Map<string, AgentSectionsEntry>,
  system: string[],
  callback: (index: number, entry: AgentSectionsEntry) => void,
): void {
  for (const [, entry] of agentSections) {
    const index = findSystemIndexForAgent(system, entry.base);
    if (index === -1) continue;

    callback(index, entry);
  }
}

function findSystemIndexForAgent(system: string[], base: string): number {
  const trimmedBase = base.trim();
  return system.findIndex((s) => s.trim() === trimmedBase);
}

/**
 * Resolve the best-matching vendor family key from the vendorPrompts map for a model ID.
 *
 * Uses the same matching order as KNOWN_FAMILIES: first family whose name appears in
 * modelId wins. Returns undefined when no family matches — no fallback is applied,
 * to avoid injecting family-specific prompts into unrelated model sessions.
 */
function resolveVendorFamily(
  vendorPrompts: Map<string, string>,
  modelId: string,
): string | undefined {
  for (const family of KNOWN_FAMILIES) {
    if (modelId.includes(family) && vendorPrompts.has(family)) {
      return family;
    }
  }
  return undefined;
}

/**
 * Append the global vendor prompt for the resolved model family to every system
 * prompt string that matches a known agent base prompt.
 *
 * The global vendor prompt is appended AFTER any per-agent model section already
 * injected by injectModelSections. Only applied to system strings that match a
 * known agent base — non-agent system prompts injected by opencode itself are
 * intentionally excluded.
 */
function injectVendorPrompts(
  agentSections: Map<string, AgentSectionsEntry>,
  vendorPrompts: Map<string, string>,
  modelId: string,
  system: string[],
): void {
  // Fast-path: no vendor prompts registered, skip all iteration
  if (vendorPrompts.size === 0) return;

  const family = resolveVendorFamily(vendorPrompts, modelId);
  if (family === undefined) return;

  const vendorPrompt = vendorPrompts.get(family)!;

  const seenIndexes = new Set<number>();
  forEachMatchedSystemEntry(agentSections, system, (idx) => {
    if (seenIndexes.has(idx)) return;

    system[idx] = `${system[idx]!}\n\n${vendorPrompt}`;
    seenIndexes.add(idx);
  });
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
