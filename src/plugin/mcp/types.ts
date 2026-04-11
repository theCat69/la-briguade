import type { McpLocalConfig, McpRemoteConfig } from "@opencode-ai/sdk";
import { z } from "zod";

import { SAFE_RECORD_KEY, isSafePermissionSubKey } from "../../config/schema.js";

const DISALLOWED_COMMAND_CHARS = /[;|&$`<>!]/;

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

export const SkillPermissionFrontmatterSchema = z
  .object({ bash: SkillBashPermissionSchema.optional() });

export type SkillMcpEntry = z.infer<typeof SkillMcpEntrySchema>;
export type SkillMcpMap = Record<string, McpLocalConfig | McpRemoteConfig>;
export type SkillMcpBinding = { id: string; permission: Record<string, string> };
export type SkillMcpIndex = Record<string, SkillMcpBinding[]>;
export type SkillBashPermIndex = Record<string, Record<string, string>>;
