import { readFileSync } from "node:fs";
import { resolve, basename } from "node:path";

import type { AgentConfig } from "@opencode-ai/sdk";

import { resolveAgentConfig } from "../config/merge.js";
import type { LaBriguadeConfig } from "../config/schema.js";
import type { Config } from "../types/plugin.js";
import { parseFrontmatter } from "../utils/frontmatter.js";
import { parseModelSections } from "../utils/model-sections.js";
import type { AgentSectionsEntry } from "../hooks/index.js";
import { readDirSafe } from "../utils/read-dir.js";

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
  contentDir: string,
  userConfig?: LaBriguadeConfig,
): RegisterAgentsResult {
  const agentSections: Map<string, AgentSectionsEntry> = new Map();
  const agentsDir = resolve(contentDir, "agents");

  const entries = readDirSafe(agentsDir, "agents");
  if (entries === undefined) return { agentSections };

  const mdFiles = entries.filter((f) => f.endsWith(".md"));
  if (mdFiles.length === 0) return { agentSections };

  const parsedAgents: Record<string, Record<string, unknown>> = {};

  for (const file of mdFiles) {
    const filePath = resolve(agentsDir, file);

    let raw: string;
    try {
      raw = readFileSync(filePath, "utf-8");
    } catch {
      console.warn(`[la-briguade] Could not read agent file: ${filePath}`);
      continue;
    }

    const { attributes, body } = parseFrontmatter(raw);
    const { base, sections } = parseModelSections(body);
    const agentName = agentNameFromFilename(file);

    const agentConfig: Record<string, unknown> = {
      prompt: base,
    };

    for (const key of ALLOWED_AGENT_KEYS) {
      if (key in attributes) {
        agentConfig[key] = attributes[key];
      }
    }

    if (userConfig !== undefined) {
      // AgentConfig has an index signature [key: string]: unknown, so the
      // Record<string, unknown> built from frontmatter is structurally compatible.
      // The cast is safe: we only add known AgentConfig fields above.
      const resolved = resolveAgentConfig(
        agentName,
        agentConfig as AgentConfig,
        userConfig,
      );
      parsedAgents[agentName] = resolved as Record<string, unknown>;
    } else {
      parsedAgents[agentName] = agentConfig;
    }

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
