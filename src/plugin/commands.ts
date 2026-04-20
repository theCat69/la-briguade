import type { Config } from "../types/plugin.js";
import { parseFrontmatter } from "../utils/content/frontmatter.js";
import { loadContentFiles } from "../utils/content/load-content.js";
import { readContentFile } from "../utils/content/read-content-file.js";
import { isRecord } from "../utils/support/type-guards.js";

interface CommandConfig {
  template: string;
  description?: string;
  agent?: string;
  model?: string;
  subtask?: boolean;
}

const MAX_COMMAND_FILE_LENGTH = 50_000;

/**
 * Register all slash command definitions from content/commands/ into the config.
 * Reads .md files with YAML frontmatter, parses them into command config objects,
 * and merges them into `config.command`.
 */
export function registerCommands(config: Config, commandDirs: string[]): void {
  const parsedCommands = loadContentFiles(commandDirs, ".md", (filePath, stem) => {
    const raw = readContentFile(filePath, MAX_COMMAND_FILE_LENGTH, "command");

    const { attributes, body } = parseFrontmatter(raw);

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

    return {
      commandName: stem,
      commandConfig,
    };
  });

  if (parsedCommands.size === 0) return;

  const nextCommands: Record<string, CommandConfig> = {};
  for (const parsed of parsedCommands.values()) {
    nextCommands[parsed.commandName] = parsed.commandConfig;
  }

  const existingCommands = isRecord(config.command) ? config.command : {};
  config.command = { ...existingCommands, ...nextCommands };
}
