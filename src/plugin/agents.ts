import { readdirSync, readFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import type { Config } from "../types/plugin.js";
import { parseFrontmatter } from "../utils/frontmatter.js";

/**
 * Shape of the YAML frontmatter in agent .md files.
 * All fields are optional — a file with only a body is a valid agent definition.
 */
interface AgentFrontmatter {
  description?: string;
  mode?: "subagent" | "primary" | "all";
  color?: string;
  model?: string;
  temperature?: number;
  top_p?: number;
  disable?: boolean;
  maxSteps?: number;
  permission?: Record<string, unknown>;
  tools?: Record<string, boolean>;
  [key: string]: unknown;
}

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

/**
 * Register all agent definitions from content/agents/ into the config.
 * Reads .md files with YAML frontmatter, parses them into AgentConfig objects,
 * and merges them into `config.agent`.
 */
export function registerAgents(config: Config, contentDir: string): void {
  const agentsDir = resolve(contentDir, "agents");

  let entries: string[];
  try {
    entries = readdirSync(agentsDir);
  } catch {
    console.warn(
      `[la-briguade] Could not read agents directory: ${agentsDir}`,
    );
    return;
  }

  const mdFiles = entries.filter((f) => f.endsWith(".md"));
  if (mdFiles.length === 0) return;

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

    const { attributes, body } = parseFrontmatter<AgentFrontmatter>(raw);
    const agentName = agentNameFromFilename(file);

    const agentConfig: Record<string, unknown> = {
      prompt: body,
    };

    // Map all frontmatter keys to AgentConfig properties.
    // Known keys (model, mode, permission, etc.) become first-class fields.
    // Unknown keys pass through via AgentConfig's index signature.
    for (const key of Object.keys(attributes)) {
      agentConfig[key] = attributes[key];
    }

    parsedAgents[agentName] = agentConfig;
  }

  config.agent = { ...config.agent, ...parsedAgents };
}
