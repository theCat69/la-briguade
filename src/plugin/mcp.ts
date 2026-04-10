import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import type { McpLocalConfig, McpRemoteConfig } from "@opencode-ai/sdk";
import { z } from "zod";

import { SAFE_RECORD_KEY } from "../config/schema.js";
import { parseFrontmatter } from "../utils/frontmatter.js";

import type { Config } from "../types/plugin.js";

const SKILL_FILE_NAME = "SKILL.md";
const DISALLOWED_COMMAND_CHARS = /[;|&$`<>!]/;

function resolveEnvTokens(value: string, key: string, field: string): string {
  const resolvedValue = value.replace(/\{env:([^}]+)\}/g, (_, varName: string) => {
    const normalizedVarName = varName.trim();
    const envValue = process.env[normalizedVarName];
    if (envValue === undefined) {
      console.warn(
        `[la-briguade] MCP server '${key}': env var '${normalizedVarName}' referenced in ` +
          `${field} is not set`,
      );
      return "";
    }

    return envValue;
  });

  if (field === "command" && DISALLOWED_COMMAND_CHARS.test(resolvedValue)) {
    console.warn(
      `[la-briguade] MCP server '${key}': resolved command element contains disallowed ` +
        "characters after env substitution — element skipped",
    );
    return "";
  }

  return resolvedValue;
}

const SkillMcpCommandElementSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "command entries must not be empty",
  })
  .refine((value) => !DISALLOWED_COMMAND_CHARS.test(value), {
    message: "command entries must not contain shell metacharacters",
  });

const SkillMcpPermissionRecordSchema = z
  .record(z.string(), z.enum(["allow", "ask", "deny"]))
  .refine(
    (value) => Object.keys(value).length <= 50,
    "MCP permission block must not exceed 50 entries",
  );

export const SkillMcpLocalConfigSchema = z.object({
  type: z.literal("local"),
  command: z.array(SkillMcpCommandElementSchema).min(1),
  environment: z.record(z.string(), z.string()).optional(),
  permission: SkillMcpPermissionRecordSchema.optional(),
  enabled: z.boolean().optional(),
  timeout: z.number().int().positive().optional(),
});

export const SkillMcpRemoteConfigSchema = z.object({
  type: z.literal("remote"),
  url: z.string().url(),
  permission: SkillMcpPermissionRecordSchema.optional(),
  enabled: z.boolean().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  timeout: z.number().int().positive().optional(),
});

export const SkillMcpEntrySchema = z.discriminatedUnion("type", [
  SkillMcpLocalConfigSchema,
  SkillMcpRemoteConfigSchema,
]);

export const SkillMcpMapSchema = z
  .record(z.string(), SkillMcpEntrySchema)
  .superRefine((entryMap, ctx) => {
    for (const key of Object.keys(entryMap)) {
      if (!SAFE_RECORD_KEY.test(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "MCP key contains reserved prototype keyword",
        });
      }
    }
  });

export type SkillMcpEntry = z.infer<typeof SkillMcpEntrySchema>;
export type SkillMcpMap = Record<string, McpLocalConfig | McpRemoteConfig>;
export type SkillMcpBinding = { id: string; permission: Record<string, string> };
export type SkillMcpIndex = Record<string, SkillMcpBinding[]>;

function buildPrefixedPermissionMap(
  id: string,
  permissionBlock: Record<string, string> | undefined,
): Record<string, string> {
  if (permissionBlock === undefined) {
    return { [`${id}_*`]: "allow" };
  }

  const prefixedPermissions: Record<string, string> = {};
  for (const [toolName, value] of Object.entries(permissionBlock)) {
    prefixedPermissions[`${id}_${toolName}`] = value;
  }
  return prefixedPermissions;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function toSdkMcpEntry(key: string, entry: SkillMcpEntry): McpLocalConfig | McpRemoteConfig {
  if (entry.type === "local") {
    const normalized: McpLocalConfig = {
      type: "local",
      command: entry.command.map((element) => resolveEnvTokens(element, key, "command")),
    };

    if (entry.environment !== undefined) {
      normalized.environment = Object.fromEntries(
        Object.entries(entry.environment).map(([envKey, envValue]) => [
          envKey,
          resolveEnvTokens(envValue, key, "environment"),
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
        resolveEnvTokens(headerValue, key, "headers"),
      ]),
    );
  }
  if (entry.timeout !== undefined) {
    normalized.timeout = entry.timeout;
  }

  return normalized;
}

function getErrorCode(error: unknown): string | undefined {
  if (error != null && typeof error === "object" && "code" in error) {
    const code = error.code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function collectSkillMcps(
  skillDirs: string[],
): { mcpMap: SkillMcpMap; skillMcpIndex: SkillMcpIndex } {
  const collected: SkillMcpMap = {};
  const skillMcpIndex: SkillMcpIndex = {};
  const seenBySkillDir = new Map<string, string>();

  for (const skillDir of skillDirs) {
    const skillFilePath = resolve(skillDir, SKILL_FILE_NAME);

    let rawSkillContent: string;
    try {
      rawSkillContent = readFileSync(skillFilePath, "utf8");
    } catch (error) {
      if (getErrorCode(error) === "ENOENT") {
        continue;
      }

      console.warn(`[la-briguade] Could not read skill file: ${skillFilePath}`, error);
      continue;
    }

    const { attributes } = parseFrontmatter(rawSkillContent);
    const mcpAttributes = attributes["mcp"];
    if (mcpAttributes === undefined) {
      continue;
    }

    const parsedMcpMap = SkillMcpMapSchema.safeParse(mcpAttributes);
    if (!parsedMcpMap.success) {
      console.warn(
        `[la-briguade] Invalid skill MCP frontmatter in: ${skillFilePath}`,
        parsedMcpMap.error.issues,
      );
      continue;
    }

    const skillName = basename(skillDir);

    for (const [key, entry] of Object.entries(parsedMcpMap.data)) {
      const firstSkillDir = seenBySkillDir.get(key);
      if (firstSkillDir !== undefined) {
        console.warn(
          `[la-briguade] skill MCP conflict: key "${key}" declared by both ` +
            `"${firstSkillDir}" and "${skillDir}" — "${firstSkillDir}" wins`,
        );
        continue;
      }

      seenBySkillDir.set(key, skillDir);
      collected[key] = toSdkMcpEntry(key, entry);

      const skillBindings = skillMcpIndex[skillName] ?? [];
      skillBindings.push({
        id: key,
        permission: buildPrefixedPermissionMap(key, entry.permission),
      });
      skillMcpIndex[skillName] = skillBindings;
    }
  }

  return { mcpMap: collected, skillMcpIndex };
}

export function injectSkillMcpPermissions(input: Config, skillMcpIndex: SkillMcpIndex): void {
  if (!isRecord(input.agent)) {
    return;
  }

  for (const agentConfig of Object.values(input.agent)) {
    const maybeAgentConfig: unknown = agentConfig;
    if (!isRecord(maybeAgentConfig)) {
      continue;
    }

    const rawPermission = maybeAgentConfig["permission"];
    if (!isRecord(rawPermission)) {
      continue;
    }

    const rawSkillPerms = rawPermission["skill"];
    if (!isRecord(rawSkillPerms)) {
      continue;
    }

    for (const [skillName, bindings] of Object.entries(skillMcpIndex)) {
      const directPermission = rawSkillPerms[skillName];
      if (directPermission === "deny") {
        continue;
      }

      let resolvedSkillPermission: unknown;
      if (directPermission === "allow" || directPermission === "ask") {
        resolvedSkillPermission = directPermission;
      } else {
        resolvedSkillPermission = rawSkillPerms["*"];
      }

      if (resolvedSkillPermission !== "allow" && resolvedSkillPermission !== "ask") {
        continue;
      }

      for (const binding of bindings) {
        for (const [permissionKey, permissionValue] of Object.entries(binding.permission)) {
          if (permissionValue === "deny") {
            continue;
          }
          if (rawPermission[permissionKey] === undefined) {
            rawPermission[permissionKey] = permissionValue;
          }
        }
      }
    }
  }
}

export function mergeSkillMcps(config: Config, collected: SkillMcpMap): void {
  const mergedMcpConfig: NonNullable<Config["mcp"]> = {
    ...collected,
    ...(config.mcp ?? {}),
  };

  config.mcp = mergedMcpConfig;
}
