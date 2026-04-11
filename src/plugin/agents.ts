import { readFileSync } from "node:fs";
import { basename } from "node:path";

import type { AgentConfig } from "@opencode-ai/sdk";

import { resolveAgentConfig, swapOpusModel } from "../config/merge.js";
import { AgentToolsSchema } from "../config/schema.js";
import type { LaBriguadeConfig } from "../config/schema.js";
import type { Config } from "../types/plugin.js";
import { parseFrontmatter } from "../utils/frontmatter.js";
import { loadContentFiles } from "../utils/load-content.js";
import { parseModelSections } from "../utils/model-sections.js";
import { isRecord } from "../utils/type-guards.js";
import type { AgentSectionsEntry } from "../hooks/index.js";

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
  const opusEnabled = userConfig?.opus_enabled ?? false;

  const loadedAgents = loadContentFiles(agentDirs, ".md", (filePath, stem) => {
    let raw: string;
    try {
      raw = readFileSync(filePath, "utf-8");
    } catch {
      throw new Error(`Could not read agent file: ${filePath}`);
    }

    if (raw.length > MAX_AGENT_FILE_LENGTH) {
      throw new Error(`Agent file exceeds size limit, skipping: ${filePath}`);
    }

    const { attributes, body } = parseFrontmatter(raw);
    const { base, sections } = parseModelSections(body);
    const agentName = agentNameFromFilename(`${stem}.md`);

    const agentConfig: AgentConfig = {
      prompt: base,
    };

    if (typeof attributes["description"] === "string") {
      agentConfig.description = attributes["description"];
    }
    if (
      attributes["mode"] === "primary" ||
      attributes["mode"] === "subagent" ||
      attributes["mode"] === "all"
    ) {
      agentConfig.mode = attributes["mode"];
    }
    if (typeof attributes["color"] === "string") {
      agentConfig.color = attributes["color"];
    }
    if (typeof attributes["model"] === "string") {
      agentConfig.model = attributes["model"];
    }
    if (typeof attributes["temperature"] === "number") {
      agentConfig.temperature = attributes["temperature"];
    }
    if (typeof attributes["top_p"] === "number") {
      agentConfig.top_p = attributes["top_p"];
    }
    if (typeof attributes["maxSteps"] === "number") {
      agentConfig.maxSteps = attributes["maxSteps"];
    }
    if (typeof attributes["disable"] === "boolean") {
      agentConfig.disable = attributes["disable"];
    }

    const permission = attributes["permission"];
    if (isRecord(permission)) {
      agentConfig.permission = permission;
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

    const resolved =
      userConfig !== undefined
        ? resolveAgentConfig(agentName, agentConfig, userConfig)
        : agentConfig;

    const final =
      !opusEnabled && typeof resolved.model === "string"
        ? { ...resolved, model: swapOpusModel(resolved.model) }
        : resolved;

    return {
      agentName,
      final,
      base,
      sections,
    };
  });

  if (loadedAgents.size === 0) return { agentSections };

  const parsedAgents: Record<string, AgentConfig> = {};

  for (const parsed of loadedAgents.values()) {
    parsedAgents[parsed.agentName] = parsed.final;

    if (Object.keys(parsed.sections).length > 0) {
      if (agentSections.has(parsed.agentName)) {
        console.warn(
          `[la-briguade] duplicate agent name in sections map: '${parsed.agentName}'`,
        );
      }
      agentSections.set(parsed.agentName, { base: parsed.base, sections: parsed.sections });
    }
  }

  const existingAgents = isRecord(config.agent) ? config.agent : {};
  config.agent = { ...existingAgents, ...parsedAgents };

  return { agentSections };
}
