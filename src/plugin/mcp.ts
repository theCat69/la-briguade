import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import type { McpLocalConfig, McpRemoteConfig } from "@opencode-ai/sdk";
import { z } from "zod";

import { SAFE_RECORD_KEY, isSafePermissionSubKey } from "../config/schema.js";
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

/** Validates a bash permission record declared in SKILL.md frontmatter. */
const SkillBashPermissionSchema = z
  .record(z.string(), z.enum(["allow", "ask", "deny"]))
  .superRefine((obj, ctx) => {
    if (Object.keys(obj).length > 50) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "bash permission block must not exceed 50 entries",
      });
    }
    for (const key of Object.keys(obj)) {
      if (!isSafePermissionSubKey(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "bash permission key must not be empty or a reserved prototype keyword",
        });
      }
    }
  });

/** Validates the top-level `permission:` block in SKILL.md frontmatter. */
const SkillPermissionFrontmatterSchema = z
  .object({ bash: SkillBashPermissionSchema.optional() });

export type SkillMcpEntry = z.infer<typeof SkillMcpEntrySchema>;
export type SkillMcpMap = Record<string, McpLocalConfig | McpRemoteConfig>;
export type SkillMcpBinding = { id: string; permission: Record<string, string> };
export type SkillMcpIndex = Record<string, SkillMcpBinding[]>;
/** Maps skill dir basename → bash permission patterns (e.g. `{ "playwright-cli *": "allow" }`). */
export type SkillBashPermIndex = Record<string, Record<string, string>>;

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

interface SkillFileData {
  attributes: Record<string, unknown>;
  skillName: string;
  skillFilePath: string;
}

/**
 * Reads a SKILL.md file and returns parsed frontmatter attributes.
 * Returns null when the file is absent (ENOENT silently skipped) or unreadable (with warning).
 */
function readSkillFileData(skillDir: string): SkillFileData | null {
  const skillFilePath = resolve(skillDir, SKILL_FILE_NAME);
  let rawSkillContent: string;
  try {
    rawSkillContent = readFileSync(skillFilePath, "utf8");
  } catch (error) {
    if (getErrorCode(error) === "ENOENT") {
      return null;
    }
    console.warn(`[la-briguade] Could not read skill file: ${skillFilePath}`, error);
    return null;
  }
  const { attributes } = parseFrontmatter(rawSkillContent);
  return { attributes, skillName: basename(skillDir), skillFilePath };
}

export function collectSkillMcps(
  skillDirs: string[],
): { mcpMap: SkillMcpMap; skillMcpIndex: SkillMcpIndex } {
  const collected: SkillMcpMap = {};
  const skillMcpIndex: SkillMcpIndex = {};
  const seenBySkillDir = new Map<string, string>();

  for (const skillDir of skillDirs) {
    const fileData = readSkillFileData(skillDir);
    if (fileData === null) {
      continue;
    }

    const { attributes, skillName, skillFilePath } = fileData;
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

/**
 * Reads SKILL.md frontmatter from each skill directory and collects
 * bash permission patterns declared under `permission.bash`.
 *
 * Returns a map of skill dir basename → bash permission record
 * (e.g. `{ "playwright-cli": { "playwright-cli *": "allow" } }`).
 */
export function collectSkillBashPermissions(skillDirs: string[]): SkillBashPermIndex {
  const skillBashPermIndex: SkillBashPermIndex = {};

  for (const skillDir of skillDirs) {
    const fileData = readSkillFileData(skillDir);
    if (fileData === null) {
      continue;
    }

    const { attributes, skillName, skillFilePath } = fileData;
    const permissionAttributes = attributes["permission"];
    if (permissionAttributes === undefined) {
      continue;
    }

    const parsedPermission = SkillPermissionFrontmatterSchema.safeParse(permissionAttributes);
    if (!parsedPermission.success) {
      console.warn(
        `[la-briguade] Invalid skill permission frontmatter in: ${skillFilePath}`,
        parsedPermission.error.issues,
      );
      continue;
    }

    const bashPerms = parsedPermission.data.bash;
    if (bashPerms !== undefined) {
      skillBashPermIndex[skillName] = bashPerms;
    }
  }

  return skillBashPermIndex;
}

/**
 * For each agent that opts into a skill via `permission.skill[name]: "allow"` or
 * wildcard, injects the skill's bash permission patterns into `agent.permission.bash`.
 *
 * - Initialises `permission.bash` as an empty object if absent.
 * - Skips patterns whose skill permission resolves to `"deny"`.
 * - Skips patterns with value `"deny"` in the skill bash block.
 * - Never overwrites an existing pattern (agent-declared permissions win).
 */
export function injectSkillBashPermissions(
  input: Config,
  skillBashPermIndex: SkillBashPermIndex,
): void {
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

    for (const [skillName, bashPerms] of Object.entries(skillBashPermIndex)) {
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

      const existingBash = rawPermission["bash"];

      // Scalar bash permission (for example "allow"/"ask"/"deny") takes precedence.
      // Only inject into a record-shaped bash section; never replace a scalar.
      if (existingBash !== undefined && existingBash !== null && !isRecord(existingBash)) {
        continue;
      }

      let bashSection: Record<string, unknown> | undefined = isRecord(existingBash)
        ? existingBash
        : undefined;

      for (const [pattern, value] of Object.entries(bashPerms)) {
        if (value === "deny") {
          continue;
        }
        if (bashSection === undefined) {
          bashSection = {};
          rawPermission["bash"] = bashSection;
        }
        if (bashSection[pattern] === undefined) {
          bashSection[pattern] = value;
        }
      }
    }
  }
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
