import type { PluginInput, HooksResult } from "../types/plugin.js";

/**
 * Build the plugin hooks object (event, tool.execute.before, etc.).
 * Returns a partial Hooks object to be spread into the plugin return value.
 */
export function createHooks(_ctx: PluginInput): Partial<HooksResult> {
  return {};
}
