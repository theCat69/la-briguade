import type { Config } from "../types/plugin.js";

/**
 * Register slash commands from content/commands/ into the config.
 * Each .md file becomes a command with its content as the template.
 */
export function registerCommands(_config: Config, _contentDir: string): void {
  // TODO: implement — parse content/commands/*.md and register as commands
}
