import { z } from "zod";

import { LOG_LEVELS } from "../utils/runtime/logger.js";

/** Regex that rejects keys matching reserved prototype pollution names. */
export const SAFE_RECORD_KEY = /^(?!(?:__proto__|constructor|prototype)$)[\w\-.]+$/;

/** Returns true when a key is safe from prototype pollution (permissive — allows spaces, globs, etc.). */
export function isSafePermissionSubKey(key: string): boolean {
  return (
    key.trim().length > 0 &&
    key !== "__proto__" &&
    key !== "constructor" &&
    key !== "prototype"
  );
}

const PermissionLeafSchema = z.union([z.string(), z.boolean(), z.number()]);

/** One-level-deep nested record (e.g. bash: { "playwright-cli *": "allow" }). */
const PermissionNestedSchema = z
  .record(z.string(), PermissionLeafSchema)
  .superRefine((obj, ctx) => {
    for (const key of Object.keys(obj)) {
      if (!isSafePermissionSubKey(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "nested permission key must not be empty or a reserved prototype keyword",
        });
      }
    }
  });

/**
 * Zod schema for per-agent override fields in a la-briguade config file.
 *
 * All fields are optional — only the fields present in the user config are
 * applied. `systemPromptSuffix` is appended to the agent's built-in system
 * prompt rather than replacing it. `permission` is shallow-merged on top of
 * the agent's internal defaults.
 */
export const AgentOverrideSchema = z.object({
  /** Model identifier, e.g. `"anthropic/claude-opus-4"`. Max 200 chars. */
  model: z
    .string()
    .max(200)
    .refine((v) => /^[\w\-./@]+$/.test(v), {
      message: "model identifier contains disallowed characters",
    })
    .optional(),
  /** Text appended to the agent's system prompt with a `\n\n` separator. Max 8000 chars. */
  systemPromptSuffix: z.string().max(8000).optional(),
  /** Sampling temperature (0–2). */
  temperature: z.number().min(0).max(2).optional(),
  /** Nucleus sampling probability (0–1). */
  topP: z.number().min(0).max(1).optional(),
  /** Top-K sampling (integer ≥ 0). */
  topK: z.number().int().min(0).optional(),
  /** Model variant name, e.g. `"high"` for high reasoning effort on GitHub Copilot Claude models. */
  variant: z
    .string()
    .max(100)
    .refine((v) => /^[\w.-]+$/.test(v), {
      message: "variant contains disallowed characters",
    })
    .optional(),
  /** Maximum number of output tokens (integer ≥ 1). */
  maxTokens: z.number().int().min(1).optional(),
  /** Permission overrides shallow-merged on top of the agent's internal permissions. */
  permission: z
    .record(z.string(), z.union([PermissionLeafSchema, PermissionNestedSchema]))
    .refine(
      (obj) => Object.keys(obj).every((k) => SAFE_RECORD_KEY.test(k)),
      { message: "permission keys must not contain reserved prototype keywords" },
    )
    .optional(),
});

/**
 * Zod schema for the top-level la-briguade config file (`la-briguade.json` / `.jsonc`).
 *
 * The top-level `model` field acts as a default model for all agents and is
 * overridden by any per-agent `model` field in `agents`.
 */
export const LaBriguadeConfigSchema = z.object({
  /** JSON Schema URL for editor autocompletion — not validated at runtime. */
  $schema: z.string().optional(),
  /** Default model applied to all agents unless a per-agent model is specified. */
  model: z
    .string()
    .max(200)
    .refine((v) => /^[\w\-./@]+$/.test(v), {
      message: "model identifier contains disallowed characters",
    })
    .optional(),
  /**
   * When `false` (the default), any agent using a `claude-opus-*` model is
   * automatically swapped to the equivalent `claude-sonnet-*` at startup.
   * Set to `true` to keep claude-opus models as-is.
   */
  opus_enabled: z.boolean().optional(),
  /** Per-agent override map keyed by agent identifier (e.g. `"coder"`). */
  agents: z.record(z.string(), AgentOverrideSchema).optional(),
  /** Logger verbosity for file + console output. Default is resolved at runtime. */
  log_level: z.enum(LOG_LEVELS).optional(),
});

/** TypeScript type inferred from {@link AgentOverrideSchema}. */
export type AgentOverride = z.infer<typeof AgentOverrideSchema>;
/** TypeScript type inferred from {@link LaBriguadeConfigSchema}. */
export type LaBriguadeConfig = z.infer<typeof LaBriguadeConfigSchema>;

/**
 * JSON Schema representation of {@link LaBriguadeConfigSchema}.
 *
 * Generated via Zod v4's native `z.toJSONSchema()` — use for IDE validation
 * (e.g. `$schema` pointer in `la-briguade.json`) and documentation tooling.
 */
export const configJsonSchema = z.toJSONSchema(LaBriguadeConfigSchema);
