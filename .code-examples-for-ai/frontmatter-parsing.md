<!-- Pattern: frontmatter-parsing — Safe YAML frontmatter extraction from .md files with error handling and prototype pollution guard -->

```typescript
// src/utils/content/frontmatter.ts — Parse YAML frontmatter delimited by --- fences.
// Key points to imitate:
//   1. Use yaml library's parse() — not JSON.parse, not custom regex
//   2. Always validate parsed value before casting to Record<string, unknown>
//   3. Warn on YAML parse errors and return safe defaults (never throw to caller)
//   4. Return both attributes and body so callers can use the markdown body too
//   5. Block prototype-poisoning keys (__proto__, constructor, prototype) explicitly

import { parse as parseYaml } from "yaml";

import { isRecord } from "../support/type-guards.js";
import { logger } from "../runtime/logger.js";

const FRONTMATTER_FENCE = "---";

interface ParsedFrontmatter {
  /** Parsed YAML attributes (empty object if no frontmatter found) */
  attributes: Record<string, unknown>;
  /** Markdown body after the frontmatter block */
  body: string;
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const trimmed = content.trimStart();

  if (!trimmed.startsWith(FRONTMATTER_FENCE)) {
    return { attributes: {}, body: content };
  }

  const afterOpening = trimmed.indexOf("\n");
  if (afterOpening === -1) {
    return { attributes: {}, body: content };
  }

  const closingIndex = trimmed.indexOf(`\n${FRONTMATTER_FENCE}`, afterOpening + 1);
  if (closingIndex === -1) {
    return { attributes: {}, body: content };
  }

  const yamlBlock = trimmed.slice(afterOpening + 1, closingIndex);
  const bodyStart = closingIndex + 1 + FRONTMATTER_FENCE.length;

  // Skip optional newline after closing fence
  const body = trimmed[bodyStart] === "\n"
    ? trimmed.slice(bodyStart + 1)
    : trimmed.slice(bodyStart);

  let parsed: unknown;
  try {
    parsed = parseYaml(yamlBlock);
  } catch (err) {
    logger.warn(`Failed to parse YAML frontmatter: ${String(err)}`);
    return { attributes: {}, body };
  }

  // Guard against prototype-poisoning keys before building the attributes map
  const POISON_KEYS = new Set(["__proto__", "constructor", "prototype"]);

  const attributes: Record<string, unknown> = {};
  if (isRecord(parsed)) {
    for (const [key, value] of Object.entries(parsed)) {
      if (POISON_KEYS.has(key)) {
        logger.warn(`Blocked prototype-poisoning frontmatter key: ${key}`);
        continue;
      }
      attributes[key] = value;
    }
  }

  return { attributes, body };
}
```
