import { readFileSync } from "node:fs";
import { basename } from "node:path";

import type { AgentConfig } from "@opencode-ai/sdk";

import { resolveAgentConfig, swapOpusModel } from "../config/merge.js";
import { AgentToolsSchema } from "../config/schema.js";
import type { LaBriguadeConfig } from "../config/schema.js";
import type { Config } from "../types/plugin.js";
import { collectFiles } from "../utils/content-merge.js";
import { parseFrontmatter } from "../utils/frontmatter.js";
import { parseModelSections } from "../utils/model-sections.js";
import type { AgentSectionsEntry } from "../hooks/index.js";

const ALLOWED_AGENT_KEYS = [
  "description",
  "mode",
  "color",
  "model",
  "temperature",
  "top_p",
  "maxSteps",
  "permission",
  "disable",
] as const;
const MAX_AGENT_FILE_LENGTH = 50_000;

/**
 * Derive the agent registration key from a filename.
 *
 * - Strips the `.md` extension
 * - Lowercases the first character (preserves hyphens)
 *
 * Examples:
 *   Orchestrator.md → orchestrator
 *   security-reviewer.md → security-reviewer
 */
function agentNameFromFilename(filename: string): string {
  const stem = basename(filename, ".md");
  return stem.charAt(0).toLowerCase() + stem.slice(1);
}

/** Return type for registerAgents — includes the per-agent model sections map. */
export type RegisterAgentsResult = {
  agentSections: Map<string, AgentSectionsEntry>;
};

/**
 * Register all agent definitions from content/agents/ into the config.
 * Reads .md files with YAML frontmatter, parses them into AgentConfig objects,
 * applies user overrides from the loaded config, and merges them into `config.agent`.
 *
 * Also parses model-specific sections from each agent body and returns them
 * keyed by the trimmed base prompt text for use in the system transform hook.
 */
export function registerAgents(
  config: Config,
  agentDirs: string[],
  userConfig?: LaBriguadeConfig,
): RegisterAgentsResult {
  const agentSections: Map<string, AgentSectionsEntry> = new Map();
  const mergedAgentFiles = collectFiles(agentDirs, ".md");
  if (mergedAgentFiles.size === 0) return { agentSections };

  // Compute once outside the per-agent loop — the flag is the same for all agents.
  const opusEnabled = userConfig?.opus_enabled ?? false;

  const parsedAgents: Record<string, Record<string, unknown>> = {};

  for (const [stem, filePath] of mergedAgentFiles) {
    let raw: string;
    try {
      raw = readFileSync(filePath, "utf-8");
    } catch {
      console.warn(`[la-briguade] Could not read agent file: ${filePath}`);
      continue;
    }

    if (raw.length > MAX_AGENT_FILE_LENGTH) {
      console.warn(`[la-briguade] Agent file exceeds size limit, skipping: ${filePath}`);
      continue;
    }

    const { attributes, body } = parseFrontmatter(raw);
    const { base, sections } = parseModelSections(body);
    const agentName = agentNameFromFilename(`${stem}.md`);

    const agentConfig: Record<string, unknown> = {
      prompt: base,
    };

    for (const key of ALLOWED_AGENT_KEYS) {
      if (key in attributes) {
        agentConfig[key] = attributes[key];
      }
    }

    if (attributes["tools"] !== undefined) {
      const parsedTools = AgentToolsSchema.safeParse(attributes["tools"]);

      if (parsedTools.success) {
        const validatedTools = parsedTools.data;
        if (validatedTools !== undefined && Object.keys(validatedTools).length > 0) {
          agentConfig["tools"] = validatedTools;
        }
      } else {
        delete agentConfig["tools"];
        const reason = parsedTools.error.issues.map((issue) => issue.message).join("; ");
        console.warn(`[la-briguade] agent ${agentName}: invalid tools field — ${reason}`);
      }
    }

    // AgentConfig has an index signature [key: string]: unknown, so the
    // Record<string, unknown> built from frontmatter is structurally compatible.
    // The cast is safe: we only add known AgentConfig fields above.
    const resolved: AgentConfig =
      userConfig !== undefined
        ? resolveAgentConfig(agentName, agentConfig as AgentConfig, userConfig)
        : (agentConfig as AgentConfig);

    // When opus_enabled is false (default), swap any claude-opus-* model to
    // the equivalent claude-sonnet-* — produces a new object, never mutates.
    // This applies regardless of whether a user config was found.
    const final =
      !opusEnabled && resolved.model != null
        ? { ...resolved, model: swapOpusModel(resolved.model) }
        : resolved;
    parsedAgents[agentName] = final as Record<string, unknown>;

    if (Object.keys(sections).length > 0) {
      if (agentSections.has(agentName)) {
        console.warn(`[la-briguade] duplicate agent name in sections map: '${agentName}'`);
      }
      agentSections.set(agentName, { base, sections });
    }
  }

  config.agent = { ...config.agent, ...parsedAgents };

  return { agentSections };
}
