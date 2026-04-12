import type { PluginInput, HooksResult } from "../types/plugin.js";
import { resolveModelSection, KNOWN_FAMILIES } from "../utils/model-sections.js";
import type { ModelSegment } from "../utils/model-sections.js";
import { logger } from "../utils/logger.js";
import { initNotifier, notifier } from "../utils/notifier.js";
import { isRecord } from "../utils/type-guards.js";

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

/** Per-agent entry holding base prompt text and ordered model segments. */
export type AgentSectionsEntry = {
  base: string;
  segments: ModelSegment[];
};

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
 * @param agentSkillPerms - Per-agent skill permission map extracted from frontmatter
 *   permission.skill blocks.
 */
export function createHooks(
  ctx: PluginInput,
  agentSections: ReadonlyMap<string, AgentSectionsEntry>,
  vendorPrompts: ReadonlyMap<string, string>,
  agentSkillPerms: ReadonlyMap<string, Record<string, string>>,
): Partial<HooksResult> {
  initNotifier(ctx);
  const sessionAgentMap = new Map<string, string>();

  return {
    "chat.params": async (input) => {
      sessionAgentMap.set(input.sessionID, input.agent);
    },

    "tool.execute.before": async (input, output) => {
      gateSkillToolExecution(input, output, sessionAgentMap, agentSkillPerms);
    },

    "tool.execute.after": async (input, output) => {
      truncateLargeOutput(output);
      appendEditErrorHint(input.tool, output);
    },

    event: async ({ event }) => {
      detectEmptyResponse(event);
      cleanupDeletedSession(event, sessionAgentMap);
    },

    "experimental.chat.system.transform": async (input, output) => {
      // Safe access: id may be absent on unexpected model shapes
      const modelId = input.model?.id?.toLowerCase() ?? "";
      injectModelSections(agentSections, modelId, output.system);
      injectVendorPrompts(agentSections, vendorPrompts, modelId, output.system);
    },
  };
}

/** Gates skill tool execution per agent permission.skill["*"] deny-mode policy. Mutates output.args.name to "" to block. */
function gateSkillToolExecution(
  input: { tool: string; sessionID: string },
  output: { args: unknown },
  sessionAgentMap: ReadonlyMap<string, string>,
  agentSkillPerms: ReadonlyMap<string, Record<string, string>>,
): void {
  if (input.tool !== "skill") return;

  const agentName = sessionAgentMap.get(input.sessionID);
  if (agentName === undefined) return;

  const perms = agentSkillPerms.get(agentName);
  if (perms === undefined) return;
  if (perms["*"] !== "deny") return;

  const args = output.args;
  if (!isRecord(args)) {
    logger.warn(
      `[skill-gate] Unexpected non-record args for skill tool call (session: ${input.sessionID})`,
    );
    output.args = { name: "" };
    return;
  }

  const requestedSkillName = args["name"];
  if (typeof requestedSkillName !== "string") {
    return;
  }

  if (requestedSkillName === "") {
    logger.warn(
      `[skill-gate] Empty skill name in deny-mode for agent "${agentName}" (session: ${input.sessionID}); blocking`,
    );
    return;
  }

  const permission = perms[requestedSkillName];
  if (permission === "allow" || permission === "ask") return;

  output.args = { ...args, name: "" };
}

/** Removes the session→agent mapping when a session is deleted to prevent memory leaks. */
function cleanupDeletedSession(
  event: { type: string; properties?: unknown },
  sessionAgentMap: Map<string, string>,
): void {
  if (event.type !== "session.deleted") return;
  if (!isRecord(event.properties)) return;

  const info = event.properties["info"];
  if (!isRecord(info)) return;

  const sessionID = info["id"];
  if (typeof sessionID !== "string") return;

  sessionAgentMap.delete(sessionID);
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
 * For each system prompt string, check if it matches a known agent base prompt.
 * If a match is found, append ordered matching segments to that string.
 *
 * Resolution strategy:
 * 1. Match model family using KNOWN_FAMILIES scan order
 * 2. Include each segment in document order when target is `all` or matched family
 * 3. Legacy fallback to first `claude` segment only when no `all` segment exists
 */
function injectModelSections(
  agentSections: ReadonlyMap<string, AgentSectionsEntry>,
  modelId: string,
  system: string[],
): void {
  // Fast-path: nothing registered, skip all iteration
  if (agentSections.size === 0) return;

  forEachMatchedSystemEntry(agentSections, system, (idx, entry) => {
    const match = resolveModelSection(entry.segments, modelId);
    if (match === undefined) return;

    system[idx] = `${system[idx]!}\n\n${match}`;
  });
}

function forEachMatchedSystemEntry(
  agentSections: ReadonlyMap<string, AgentSectionsEntry>,
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
  // Match both the original base string and strings already augmented by
  // a prior injectModelSections pass (which appends "\n\n<section>").
  return system.findIndex(
    (s) => s.trim() === trimmedBase || s.startsWith(trimmedBase + "\n\n"),
  );
}

/**
 * Resolve the best-matching vendor family key from the vendorPrompts map for a model ID.
 *
 * Uses the same matching order as KNOWN_FAMILIES: first family whose name appears in
 * modelId wins. Returns undefined when no family matches — no fallback is applied,
 * to avoid injecting family-specific prompts into unrelated model sessions.
 */
function resolveVendorFamily(
  vendorPrompts: ReadonlyMap<string, string>,
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
  agentSections: ReadonlyMap<string, AgentSectionsEntry>,
  vendorPrompts: ReadonlyMap<string, string>,
  modelId: string,
  system: string[],
): void {
  // Fast-path: no vendor prompts registered, skip all iteration
  if (vendorPrompts.size === 0) return;

  const family = resolveVendorFamily(vendorPrompts, modelId);
  if (family === undefined) return;

  const vendorPrompt = vendorPrompts.get(family)!;

  // injectModelSections intentionally allows repeated matches because each matched
  // entry may contribute a distinct section. Here we dedupe by index because the
  // vendor prompt is global per family and must be appended at most once per system entry.
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
  if (!isRecord(props)) return;

  const info = props["info"];
  if (!isRecord(info)) return;

  const role = info["role"];
  if (role !== "assistant") return;

  const time = info["time"];
  if (!isRecord(time)) return;
  if (time["completed"] === undefined) return;

  const tokens = info["tokens"];
  if (!isRecord(tokens)) return;

  const output = tokens["output"];
  if (output === 0) {
    notifier.warn("Empty assistant response detected — the model produced no output tokens.");
  }
}
