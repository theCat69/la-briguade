import { readFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import type { Config } from "../types/plugin.js";
import { parseFrontmatter } from "../utils/frontmatter.js";
import { readDirSafe } from "../utils/read-dir.js";

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

  const entries = readDirSafe(commandsDir, "commands");
  if (entries === undefined) return;

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

    const { attributes, body } = parseFrontmatter(raw);
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
