import { homedir } from "node:os";
import { join } from "node:path";

import { inspectConfigLoad } from "./loader.js";
import type { AgentOverride, LaBriguadeConfig } from "./schema.js";
import { logger } from "../utils/runtime/logger.js";

export type UserConfigMergeSource = "none" | "global" | "project" | "merged";

export interface ResolvedUserConfigDetails {
  global: ReturnType<typeof inspectConfigLoad>;
  project: ReturnType<typeof inspectConfigLoad>;
  config: LaBriguadeConfig;
  source: UserConfigMergeSource;
}

export function resolveConfigBaseDirs(projectDir: string): {
  globalDir: string;
  projectDir: string;
} {
  return {
    globalDir: join(homedir(), "la_briguade"),
    projectDir,
  };
}

export function resolveLaBriguadeConfigDir(): string {
  return join(homedir(), ".config", "la_briguade");
}

export function resolveOpencodeConfigDir(): string {
  return join(homedir(), ".config", "opencode");
}

/**
 * Resolve the merged user configuration for la-briguade.
 *
 * Loads global config from ~/.config/la_briguade/la-briguade.{json,jsonc} and
 * project config from projectDir/la-briguade.{json,jsonc}. Merges them
 * with project taking precedence over global.
 *
 * This function is synchronous — all file I/O uses sync Node APIs.
 *
 * @param projectDir - The opencode project directory (from PluginInput.directory)
 * @returns Merged LaBriguadeConfig, or an empty config if both files are absent
 */
export function resolveUserConfig(projectDir: string): LaBriguadeConfig {
  return resolveUserConfigDetails(projectDir).config;
}

export function resolveUserConfigDetails(projectDir: string): ResolvedUserConfigDetails {
  const globalDir = resolveLaBriguadeConfigDir();
  const globalConfigBasePath = join(globalDir, "la-briguade");
  const projectConfigBasePath = join(projectDir, "la-briguade");

  const globalInspection = inspectConfigLoad(globalConfigBasePath);
  const projectInspection = inspectConfigLoad(projectConfigBasePath);

  const globalResult = globalInspection.result;
  const projectResult = projectInspection.result;

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

  logger.debug(
    `la-briguade config state (global): ${describeConfigInspection(globalInspection)}`,
  );
  logger.debug(
    `la-briguade config state (project): ${describeConfigInspection(projectInspection)}`,
  );

  if (globalConfig === undefined) {
    if (projectConfig === undefined) {
      logger.debug("la-briguade config source: none");
      return {
        global: globalInspection,
        project: projectInspection,
        config: {},
        source: "none",
      };
    }
    logger.debug("la-briguade config source: project");
    return {
      global: globalInspection,
      project: projectInspection,
      config: projectConfig,
      source: "project",
    };
  }
  if (projectConfig === undefined) {
    logger.debug("la-briguade config source: global");
    return {
      global: globalInspection,
      project: projectInspection,
      config: globalConfig,
      source: "global",
    };
  }
  logger.debug("la-briguade config source: merged");
  return {
    global: globalInspection,
    project: projectInspection,
    config: mergeConfigs(globalConfig, projectConfig),
    source: "merged",
  };
}

function describeConfigInspection(inspection: ReturnType<typeof inspectConfigLoad>): string {
  if (inspection.resolvedPath === undefined) {
    return `missing (${inspection.searchedPaths.join(", ")})`;
  }

  if (inspection.result.ok) {
    return `loaded '${inspection.resolvedPath}'`;
  }

  return `${inspection.result.error.kind} in '${inspection.resolvedPath}'`;
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
