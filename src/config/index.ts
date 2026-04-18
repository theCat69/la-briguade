import { homedir } from "node:os";
import { join } from "node:path";

import { loadConfig } from "./loader.js";
import type { AgentOverride, LaBriguadeConfig } from "./schema.js";
import { logger } from "../utils/runtime/logger.js";

export function resolveConfigBaseDirs(projectDir: string): {
  globalDir: string;
  projectDir: string;
} {
  return {
    globalDir: join(homedir(), "la_briguade"),
    projectDir,
  };
}

export function resolveOpencodeConfigDir(): string {
  return join(homedir(), ".config", "opencode");
}

/**
 * Resolve the merged user configuration for la-briguade.
 *
 * Loads global config from ~/la_briguade/la-briguade.{json,jsonc} and
 * project config from projectDir/la-briguade.{json,jsonc}. Merges them
 * with project taking precedence over global.
 *
 * This function is synchronous — all file I/O uses sync Node APIs.
 *
 * @param projectDir - The opencode project directory (from PluginInput.directory)
 * @returns Merged LaBriguadeConfig, or an empty config if both files are absent
 */
export function resolveUserConfig(projectDir: string): LaBriguadeConfig {
  const { globalDir } = resolveConfigBaseDirs(projectDir);
  const globalConfigBasePath = join(globalDir, "la-briguade");
  const projectConfigBasePath = join(projectDir, "la-briguade");

  const globalResult = loadConfig(globalConfigBasePath);
  const projectResult = loadConfig(projectConfigBasePath);

  let globalConfig: LaBriguadeConfig | undefined;
  if (globalResult.ok) {
    globalConfig = globalResult.value;
  } else if (globalResult.error.kind !== "not-found") {
    logger.warn(`Global config error: ${globalResult.error.message}`);
  }

  let projectConfig: LaBriguadeConfig | undefined;
  if (projectResult.ok) {
    projectConfig = projectResult.value;
  } else if (projectResult.error.kind !== "not-found") {
    logger.warn(`Project config error: ${projectResult.error.message}`);
  }

  if (globalConfig === undefined) {
    if (projectConfig === undefined) return {};
    return projectConfig;
  }
  if (projectConfig === undefined) return globalConfig;
  return mergeConfigs(globalConfig, projectConfig);
}

/**
 * Merge global and project configs into a single LaBriguadeConfig.
 * Project values take precedence over global values.
 *
 * Per-agent entries are deep-merged field-by-field so that unrelated global
 * fields are preserved even when the project defines an override for the same
 * agent. `systemPromptSuffix` values are chained with `\n\n`.
 */
function mergeConfigs(
  globalCfg: LaBriguadeConfig,
  projectCfg: LaBriguadeConfig,
): LaBriguadeConfig {
  const mergedAgents: Record<string, AgentOverride> = { ...(globalCfg.agents ?? {}) };

  for (const [agentId, projectOverride] of Object.entries(projectCfg.agents ?? {})) {
    const existing = mergedAgents[agentId];
    if (existing === undefined) {
      mergedAgents[agentId] = projectOverride;
    } else {
      const chainedSuffix =
        [existing.systemPromptSuffix, projectOverride.systemPromptSuffix]
          .filter(Boolean)
          .join("\n\n") || undefined;

      mergedAgents[agentId] = {
        ...existing,
        ...projectOverride,
        ...(chainedSuffix !== undefined ? { systemPromptSuffix: chainedSuffix } : {}),
      };
    }
  }

  return {
    ...globalCfg,
    ...projectCfg,
    ...(Object.keys(mergedAgents).length > 0 ? { agents: mergedAgents } : {}),
  };
}
