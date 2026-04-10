<!-- Pattern: zod-config-schema — Zod v4 schema for plugin config with nested agent overrides, security constraints, and JSON Schema export -->

```typescript
// src/config/schema.ts — Define and export Zod v4 schemas + inferred TypeScript types.
// Key points to imitate:
//   1. z.record requires TWO args in Zod v4: z.record(z.string(), valueSchema)
//   2. Use z.infer<typeof Schema> for TypeScript types — single source of truth
//   3. Export both schema (for validation) and type (for TypeScript usage)
//   4. Use z.toJSONSchema() (Zod v4 native) — no extra library needed
//   5. .refine() on record fields for prototype-pollution key safety
//   6. .refine() on string fields for allowlist character validation (e.g. model identifiers)
//   7. import type for Zod-inferred types — compile-time only

import { z } from "zod";

/** Rejects reserved prototype pollution names as record keys. */
const SAFE_RECORD_KEY = /^(?!(?:__proto__|constructor|prototype)$)[\w\-.]+$/;

export const AgentOverrideSchema = z.object({
  // .refine() on string fields enforces an allowlist — not just .max()
  model: z
    .string()
    .max(200)
    .refine((v) => /^[\w\-./@]+$/.test(v), {
      message: "model identifier contains disallowed characters",
    })
    .optional(),
  systemPromptSuffix: z.string().max(8000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().min(0).optional(),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
  maxTokens: z.number().int().min(1).optional(),
  // z.record(z.string(), valueSchema) — two-arg form is REQUIRED in Zod v4
  permission: z
    .record(z.string(), z.union([z.string(), z.boolean(), z.number()]))
    .refine(
      (obj) => Object.keys(obj).every((k) => SAFE_RECORD_KEY.test(k)),
      { message: "permission keys must not contain reserved prototype keywords" },
    )
    .optional(),
  tools: z
    .record(z.string(), z.boolean())
    .refine(
      (obj) => Object.keys(obj).every((k) => SAFE_RECORD_KEY.test(k)),
      { message: "tools keys must not contain reserved prototype keywords" },
    )
    .optional(),
});

export const LaBriguadeConfigSchema = z.object({
  $schema: z.string().optional(),
  // Same .refine() allowlist as AgentOverrideSchema.model — keep them in sync
  model: z
    .string()
    .max(200)
    .refine((v) => /^[\w\-./@]+$/.test(v), {
      message: "model identifier contains disallowed characters",
    })
    .optional(),
  // Boolean flag — no refine needed, Zod guarantees the type
  // false (default): claude-opus-* swapped to claude-sonnet-* at startup
  // true: opus models kept as-is
  opus_enabled: z.boolean().optional(),
  // Two-arg z.record: first arg is key schema, second is value schema
  agents: z.record(z.string(), AgentOverrideSchema).optional(),
});

// Derive TypeScript types from schemas — no duplication
export type AgentOverride = z.infer<typeof AgentOverrideSchema>;
export type LaBriguadeConfig = z.infer<typeof LaBriguadeConfigSchema>;

// z.toJSONSchema() is Zod v4 native — returns a JSON Schema object for IDE tooling
export const configJsonSchema = z.toJSONSchema(LaBriguadeConfigSchema);
```
