import { readFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import type { Config } from "../types/plugin.js";
import { parseFrontmatter } from "../utils/frontmatter.js";
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

/**
 * Register all agent definitions from content/agents/ into the config.
 * Reads .md files with YAML frontmatter, parses them into AgentConfig objects,
 * and merges them into `config.agent`.
 */
export function registerAgents(config: Config, contentDir: string): void {
  const agentsDir = resolve(contentDir, "agents");

  const entries = readDirSafe(agentsDir, "agents");
  if (entries === undefined) return;

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

    const { attributes, body } = parseFrontmatter(raw);
    const agentName = agentNameFromFilename(file);

    const agentConfig: Record<string, unknown> = {
      prompt: body,
    };

    for (const key of ALLOWED_AGENT_KEYS) {
      if (key in attributes) {
        agentConfig[key] = attributes[key];
      }
    }

    parsedAgents[agentName] = agentConfig;
  }

  config.agent = { ...config.agent, ...parsedAgents };
}
