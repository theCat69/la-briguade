import { readdirSync, readFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import type { Config } from "../types/plugin.js";
import { parseFrontmatter } from "../utils/frontmatter.js";

/**
 * Shape of the YAML frontmatter in command .md files.
 * Only `description` is common; `agent`, `model`, and `subtask` are optional overrides.
 */
interface CommandFrontmatter {
  description?: string;
  agent?: string;
  model?: string;
  subtask?: boolean;
}

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
export function registerCommands(config: Config, contentDir: string): void {
  const commandsDir = resolve(contentDir, "commands");

  let entries: string[];
  try {
    entries = readdirSync(commandsDir);
  } catch {
    console.warn(
      `[la-briguade] Could not read commands directory: ${commandsDir}`,
    );
    return;
  }

  const mdFiles = entries.filter((f) => f.endsWith(".md"));
  if (mdFiles.length === 0) return;

  const parsedCommands: Record<
    string,
    { template: string; description?: string; agent?: string; model?: string; subtask?: boolean }
  > = {};

  for (const file of mdFiles) {
    const filePath = resolve(commandsDir, file);

    let raw: string;
    try {
      raw = readFileSync(filePath, "utf-8");
    } catch {
      console.warn(`[la-briguade] Could not read command file: ${filePath}`);
      continue;
    }

    const { attributes, body } = parseFrontmatter<CommandFrontmatter>(raw);
    const commandName = commandNameFromFilename(file);

    const commandConfig: {
      template: string;
      description?: string;
      agent?: string;
      model?: string;
      subtask?: boolean;
    } = {
      template: body,
    };

    if (attributes.description !== undefined) {
      commandConfig.description = attributes.description;
    }
    if (attributes.agent !== undefined) {
      commandConfig.agent = attributes.agent;
    }
    if (attributes.model !== undefined) {
      commandConfig.model = attributes.model;
    }
    if (attributes.subtask !== undefined) {
      commandConfig.subtask = attributes.subtask;
    }

    parsedCommands[commandName] = commandConfig;
  }

  config.command = { ...config.command, ...parsedCommands };
}
