import { z } from "zod";

/** Regex that rejects keys matching reserved prototype pollution names. */
const SAFE_RECORD_KEY = /^(?!(?:__proto__|constructor|prototype)$)[\w\-.]+$/;

/**
 * Zod schema for per-agent override fields in a la-briguade config file.
 *
 * All fields are optional — only the fields present in the user config are
 * applied. `systemPromptSuffix` is appended to the agent's built-in system
 * prompt rather than replacing it. `permission` and `tools` are shallow-merged
 * on top of the agent's internal defaults.
 */
export const AgentOverrideSchema = z.object({
  /** Model identifier, e.g. `"anthropic/claude-opus-4"`. Max 200 chars. */
  model: z.string().max(200).optional(),
  /** Text appended to the agent's system prompt with a `\n\n` separator. Max 8000 chars. */
  systemPromptSuffix: z.string().max(8000).optional(),
  /** Sampling temperature (0–2). */
  temperature: z.number().min(0).max(2).optional(),
  /** Nucleus sampling probability (0–1). */
  topP: z.number().min(0).max(1).optional(),
  /** Top-K sampling (integer ≥ 0). */
  topK: z.number().int().min(0).optional(),
  /** Reasoning effort hint for models that support it. */
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
  /** Maximum number of output tokens (integer ≥ 1). */
  maxTokens: z.number().int().min(1).optional(),
  /** Permission overrides shallow-merged on top of the agent's internal permissions. */
  permission: z
    .record(z.union([z.string(), z.boolean(), z.number()]))
    .refine(
      (obj) => Object.keys(obj).every((k) => SAFE_RECORD_KEY.test(k)),
      { message: "permission keys must not contain reserved prototype keywords" },
    )
    .optional(),
  /** Tool enable/disable flags shallow-merged on top of agent defaults. */
  tools: z
    .record(z.boolean())
    .refine(
      (obj) => Object.keys(obj).every((k) => SAFE_RECORD_KEY.test(k)),
      { message: "tools keys must not contain reserved prototype keywords" },
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
  model: z.string().max(200).optional(),
  /** Per-agent override map keyed by agent identifier (e.g. `"coder"`). */
  agents: z.record(AgentOverrideSchema).optional(),
});

/** TypeScript type inferred from {@link AgentOverrideSchema}. */
export type AgentOverride = z.infer<typeof AgentOverrideSchema>;
/** TypeScript type inferred from {@link LaBriguadeConfigSchema}. */
export type LaBriguadeConfig = z.infer<typeof LaBriguadeConfigSchema>;
