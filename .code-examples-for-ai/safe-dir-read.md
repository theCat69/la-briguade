<!-- Pattern: safe-dir-read — Defensive directory reading that returns undefined on failure with a labelled warning -->

```typescript
// src/utils/read-dir.ts — Wrap readdirSync in a try-catch that warns and returns undefined.
// Key points to imitate:
//   1. Return undefined (not []) on failure — callers must handle the missing-dir case explicitly
//   2. Always include a label parameter so the warning identifies the context
//   3. Prefix warning with "[la-briguade]" for grepping in host project logs
//   4. Never throw — callers decide whether missing content is fatal

import { readdirSync } from "node:fs";

/**
 * Read a directory's entries, returning undefined on failure.
 * Logs a warning with the given label to identify the context.
 */
export function readDirSafe(dir: string, label: string): string[] | undefined {
  try {
    return readdirSync(dir);
  } catch {
    console.warn(`[la-briguade] Could not read ${label} directory: ${dir}`);
    return undefined;
  }
}

// Usage in register*.ts:
// const files = readDirSafe(agentsDir, "agents");
// if (files === undefined) return; // dir missing — skip registration silently
```
