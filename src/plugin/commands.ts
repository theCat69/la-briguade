import { readFileSync } from "node:fs";
import { basename } from "node:path";

import type { Config } from "../types/plugin.js";
import { collectFiles } from "../utils/content-merge.js";
import { parseFrontmatter } from "../utils/frontmatter.js";

interface CommandConfig {
  template: string;
  description?: string;
  agent?: string;
  model?: string;
  subtask?: boolean;
}

const MAX_COMMAND_FILE_LENGTH = 50_000;

/**
 * Derive the command registration key from a filename.
 *
 * Strips the `.md` extension — the filename IS the slash-command name.
 *
 * Examples:
 *   critic.md → critic
 *   unslop-loop.md → unslop-loop
 */
function commandNameFromFilename(filename: string): string {
  return basename(filename, ".md");
}

/**
 * Register all slash command definitions from content/commands/ into the config.
 * Reads .md files with YAML frontmatter, parses them into command config objects,
 * and merges them into `config.command`.
 */
export function registerCommands(config: Config, commandDirs: string[]): void {
  const mergedCommandFiles = collectFiles(commandDirs, ".md");
  if (mergedCommandFiles.size === 0) return;

  const parsedCommands: Record<string, CommandConfig> = {};

  for (const [stem, filePath] of mergedCommandFiles) {
    let raw: string;
    try {
      raw = readFileSync(filePath, "utf-8");
    } catch {
      console.warn(`[la-briguade] Could not read command file: ${filePath}`);
      continue;
    }

    if (raw.length > MAX_COMMAND_FILE_LENGTH) {
      console.warn(`[la-briguade] Command file exceeds size limit, skipping: ${filePath}`);
      continue;
    }

    const { attributes, body } = parseFrontmatter(raw);
    const commandName = commandNameFromFilename(`${stem}.md`);

    const commandConfig: CommandConfig = {
      template: body,
    };

    const description = attributes["description"];
    if (typeof description === "string") {
      commandConfig.description = description;
    }

    const agent = attributes["agent"];
    if (typeof agent === "string") {
      commandConfig.agent = agent;
    }

    const model = attributes["model"];
    if (typeof model === "string") {
      commandConfig.model = model;
    }

    const subtask = attributes["subtask"];
    if (typeof subtask === "boolean") {
      commandConfig.subtask = subtask;
    }

    parsedCommands[commandName] = commandConfig;
  }

  config.command = { ...config.command, ...parsedCommands };
}
