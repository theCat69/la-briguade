<!-- Pattern: bounded-skill-loader — Reject oversized auto-inject skill files before loading prompt content -->

```typescript
import { readFileSync, statSync } from "node:fs";

const MAX_AUTO_INJECT_SKILL_LENGTH = 50_000;

function readAutoInjectSkill(filePath: string): string | undefined {
  // Inspect byte size first to avoid loading unbounded content into memory.
  if (statSync(filePath).size > MAX_AUTO_INJECT_SKILL_LENGTH) {
    logger.warn(`Auto-inject skill file exceeds size limit: ${filePath}`);
    return undefined;
  }

  const rawContent = readFileSync(filePath, "utf8");
  // Preserve a character-length check for multi-byte text.
  if (rawContent.length > MAX_AUTO_INJECT_SKILL_LENGTH) {
    logger.warn(`Auto-inject skill file exceeds size limit: ${filePath}`);
    return undefined;
  }

  return rawContent;
}
```
