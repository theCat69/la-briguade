import type { McpLocalConfig, McpRemoteConfig } from "@opencode-ai/sdk";

import type { Config } from "../../types/plugin.js";
import { logger } from "../../utils/logger.js";

import {
  DISALLOWED_COMMAND_CHARS,
  type SkillMcpEntry,
  type SkillMcpMap,
} from "./types.js";

type EnvResolutionResult = {
  value: string;
  issue?: string;
};

function resolveEnvTokens(value: string, key: string, field: string): EnvResolutionResult {
  const missingVarNames = new Set<string>();

  const resolvedValue = value.replace(/\{env:([^}]+)\}/g, (_, varName: string) => {
    const normalizedVarName = varName.trim();
    const envValue = process.env[normalizedVarName];
    if (envValue === undefined) {
      missingVarNames.add(normalizedVarName);
      return "";
    }
    return envValue;
  });

  if (missingVarNames.size > 0) {
    const formattedVarNames = [...missingVarNames].map((name) => `'${name}'`).join(", ");
    return {
      value: resolvedValue,
      issue:
        `MCP server '${key}': env var(s) ${formattedVarNames} referenced in ` +
        `${field} is not set`,
    };
  }

  if (field === "command" && DISALLOWED_COMMAND_CHARS.test(resolvedValue)) {
    return {
      value: "",
      issue:
        `MCP server '${key}': resolved command element contains disallowed ` +
        "characters after env substitution — element skipped",
    };
  }

  return { value: resolvedValue };
}

function resolveEnvValue(value: string, key: string, field: string): string {
  const resolved = resolveEnvTokens(value, key, field);
  if (resolved.issue !== undefined) {
    logger.warn(resolved.issue);
  }
  return resolved.value;
}

export function toSdkMcpEntry(key: string, entry: SkillMcpEntry): McpLocalConfig | McpRemoteConfig {
  if (entry.type === "local") {
    const normalized: McpLocalConfig = {
      type: "local",
      command: entry.command.map((element) => resolveEnvValue(element, key, "command")),
    };

    if (entry.environment !== undefined) {
      normalized.environment = Object.fromEntries(
        Object.entries(entry.environment).map(([envKey, envValue]) => [
          envKey,
          resolveEnvValue(envValue, key, "environment"),
        ]),
      );
    }
    if (entry.enabled !== undefined) {
      normalized.enabled = entry.enabled;
    }
    if (entry.timeout !== undefined) {
      normalized.timeout = entry.timeout;
    }

    return normalized;
  }

  const normalized: McpRemoteConfig = {
    type: "remote",
    url: entry.url,
  };

  if (entry.enabled !== undefined) {
    normalized.enabled = entry.enabled;
  }
  if (entry.headers !== undefined) {
    normalized.headers = Object.fromEntries(
      Object.entries(entry.headers).map(([headerKey, headerValue]) => [
        headerKey,
        resolveEnvValue(headerValue, key, "headers"),
      ]),
    );
  }
  if (entry.timeout !== undefined) {
    normalized.timeout = entry.timeout;
  }

  return normalized;
}

export function mergeSkillMcps(config: Config, collected: SkillMcpMap): void {
  const mergedMcpConfig: NonNullable<Config["mcp"]> = {
    ...collected,
    ...(config.mcp ?? {}),
  };

  config.mcp = mergedMcpConfig;
}
