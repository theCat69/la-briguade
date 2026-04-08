import type { Config } from "../types/plugin.js";

/**
 * Register all agent definitions from content/agents/ into the config.
 * Reads .md files with YAML frontmatter, parses them into AgentConfig objects,
 * and merges them into `config.agent`.
 */
export function registerAgents(_config: Config, _contentDir: string): void {
  // TODO: implement — parse content/agents/*.md frontmatter and register
}
