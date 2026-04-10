import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { McpLocalConfig, McpRemoteConfig } from "@opencode-ai/sdk";
import { z } from "zod";

import { SAFE_RECORD_KEY } from "../config/schema.js";
import { parseFrontmatter } from "../utils/frontmatter.js";

import type { Config } from "../types/plugin.js";

const SKILL_FILE_NAME = "SKILL.md";
const DISALLOWED_COMMAND_CHARS = /[\\/;|&$`<>!]/;

const SkillMcpCommandElementSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "command entries must not be empty",
  })
  .refine((value) => !DISALLOWED_COMMAND_CHARS.test(value), {
    message: "command entries must not contain path separators or shell metacharacters",
  });

export const SkillMcpLocalConfigSchema = z.object({
  type: z.literal("local"),
  command: z.array(SkillMcpCommandElementSchema).min(1),
  environment: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
  timeout: z.number().int().positive().optional(),
});

export const SkillMcpRemoteConfigSchema = z.object({
  type: z.literal("remote"),
  url: z.string().url(),
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

function toSdkMcpEntry(entry: SkillMcpEntry): McpLocalConfig | McpRemoteConfig {
  if (entry.type === "local") {
    const normalized: McpLocalConfig = {
      type: "local",
      command: entry.command,
    };

    if (entry.environment !== undefined) {
      normalized.environment = entry.environment;
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
    normalized.headers = entry.headers;
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

export function collectSkillMcps(skillDirs: string[]): SkillMcpMap {
  const collected: SkillMcpMap = {};
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
      collected[key] = toSdkMcpEntry(entry);
    }
  }

  return collected;
}

export function mergeSkillMcps(config: Config, collected: SkillMcpMap): void {
  const mergedMcpConfig: NonNullable<Config["mcp"]> = {
    ...collected,
    ...(config.mcp ?? {}),
  };

  config.mcp = mergedMcpConfig;
}
