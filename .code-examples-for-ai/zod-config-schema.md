<!-- Pattern: zod-config-schema — Zod v3 schema for plugin config with nested agent overrides -->

```typescript
// src/config/schema.ts — Define and export Zod schemas + inferred TypeScript types.
// Key points to imitate:
//   1. Use z.infer<typeof Schema> for TypeScript types — single source of truth
//   2. Export both schema (for validation) and type (for TypeScript usage)
//   3. Use z.record(z.boolean()) for tools map, z.record(z.unknown()) for open objects
//   4. Use import type for Zod-inferred types — they are compile-time only

import { z } from "zod";

export const AgentOverrideSchema = z.object({
  model: z.string().optional(),
  systemPromptSuffix: z.string().optional(),
  temperature: z.number().optional(),
  // ... other fields
  permission: z.record(z.unknown()).optional(),
  tools: z.record(z.boolean()).optional(),
});

export const LaBriguadeConfigSchema = z.object({
  $schema: z.string().optional(),
  model: z.string().optional(),
  agents: z.record(AgentOverrideSchema).optional(),
});

// Derive TypeScript types from schemas — no duplication
export type AgentOverride = z.infer<typeof AgentOverrideSchema>;
export type LaBriguadeConfig = z.infer<typeof LaBriguadeConfigSchema>;
```
