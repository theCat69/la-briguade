<!-- Pattern: global-prompts-loader — Loading shared prompt content from a directory, keyed by filename stem -->

```typescript
// src/plugin/vendors.ts — Load global vendor prompts from a content subdirectory.
// Key points to imitate:
//   1. Use readDirSafe() — never call readdirSync directly; handles missing dirs gracefully
//   2. Key = lowercased filename stem (e.g. "claude", "gpt") derived from basename
//   3. Value = full file body (trim whitespace for clean appending)
//   4. Warn on per-file read failure but continue — never fail the whole map
//   5. Return empty Map if directory is missing or empty (never return undefined)

import { readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { readDirSafe } from "../utils/read-dir.js";

export function loadVendorPrompts(contentDir: string): Map<string, string> {
  const vendorPromptsDir = join(contentDir, "vendor-prompts");
  const result: Map<string, string> = new Map();

  const entries = readDirSafe(vendorPromptsDir, "vendor-prompts");
  if (entries === undefined) return result;  // directory missing — return empty Map

  for (const file of entries.filter((f) => f.endsWith(".md"))) {
    const key = basename(file, ".md").toLowerCase();  // "claude.md" → "claude"
    try {
      result.set(key, readFileSync(join(vendorPromptsDir, file), "utf-8").trim());
    } catch {
      console.warn(`[la-briguade] Could not read vendor prompt file: ${join(vendorPromptsDir, file)}`);
    }
  }

  return result;
}

// Wiring in src/index.ts — call before config() and pass to createHooks():
// const vendorPrompts = loadVendorPrompts(contentDir);
// ...createHooks(ctx, agentSections, vendorPrompts)
```
