import { basename } from "node:path";

import type { AgentConfig } from "@opencode-ai/sdk";

import { resolveAgentConfig, swapOpusModel } from "../config/merge.js";
import { isSafePermissionSubKey, type LaBriguadeConfig } from "../config/schema.js";
import type { Config } from "../types/plugin.js";
import { parseFrontmatter } from "../utils/frontmatter.js";
import { logger } from "../utils/logger.js";
import { loadContentFiles } from "../utils/load-content.js";
import { parseModelSections } from "../utils/model-sections.js";
import { readContentFile } from "../utils/read-content-file.js";
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
  agentSkillPerms: Map<string, Record<string, string>>;
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
  const agentSkillPerms: Map<string, Record<string, string>> = new Map();
  const opusEnabled = userConfig?.opus_enabled ?? false;

  const loadedAgents = loadContentFiles(agentDirs, ".md", (filePath, stem) => {
    const raw = readContentFile(filePath, MAX_AGENT_FILE_LENGTH, "agent");

    const { attributes, body } = parseFrontmatter(raw);
    const { base, segments } = parseModelSections(body);
    const agentName = agentNameFromFilename(stem);

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

    const skillPerms = parseSkillPermissions(permission);

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
      segments,
      skillPerms,
    };
  });

  if (loadedAgents.size === 0) return { agentSections, agentSkillPerms };

  const parsedAgents: Record<string, AgentConfig> = {};

  for (const parsed of loadedAgents.values()) {
    parsedAgents[parsed.agentName] = parsed.final;

    if (parsed.segments.length > 0) {
      if (agentSections.has(parsed.agentName)) {
        logger.warn(`duplicate agent name in sections map: '${parsed.agentName}'`);
      }
      agentSections.set(parsed.agentName, { base: parsed.base, segments: parsed.segments });
    }

    if (parsed.skillPerms !== undefined) {
      agentSkillPerms.set(parsed.agentName, parsed.skillPerms);
    }
  }

  const existingAgents = isRecord(config.agent) ? config.agent : {};
  config.agent = { ...existingAgents, ...parsedAgents };

  return { agentSections, agentSkillPerms };
}

function parseSkillPermissions(
  permission: unknown,
): Record<string, string> | undefined {
  if (!isRecord(permission)) return undefined;

  const skill = permission["skill"];
  if (!isRecord(skill)) return undefined;

  const entries: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [key, value] of Object.entries(skill)) {
    if (!isSafePermissionSubKey(key)) {
      logger.warn(`[agents] permission.skill key "${key}" is unsafe; ignoring`);
      continue;
    }

    if (typeof value !== "string") {
      logger.warn(
        `[agents] permission.skill entry "${key}" has non-string value (${typeof value}); ignoring`,
      );
      continue;
    }

    const normalized = value.toLowerCase();
    if (value !== normalized) {
      logger.warn(
        `[agents] permission.skill entry "${key}" value "${value}" must be lowercase; ignoring`,
      );
      continue;
    }

    if (normalized !== "allow" && normalized !== "ask" && normalized !== "deny") {
      logger.warn(
        `[agents] permission.skill entry "${key}" has unrecognized value "${value}"; ignoring`,
      );
      continue;
    }

    entries[key] = normalized;
  }

  return Object.keys(entries).length > 0 ? entries : undefined;
}
