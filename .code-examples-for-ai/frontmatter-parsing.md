<!-- Pattern: frontmatter-parsing — Safe YAML frontmatter extraction from .md files with error handling -->

```typescript
// src/utils/frontmatter.ts — Parse YAML frontmatter delimited by --- fences.
// Key points to imitate:
//   1. Use yaml library's parse() — not JSON.parse, not custom regex
//   2. Always validate parsed value before casting to Record<string, unknown>
//   3. Warn on YAML parse errors and return safe defaults (never throw to caller)
//   4. Return both attributes and body so callers can use the markdown body too

import { parse as parseYaml } from "yaml";

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
    console.warn("[la-briguade] Failed to parse YAML frontmatter:", err);
    return { attributes: {}, body: "" };
  }

  // Always validate before casting — parseYaml can return arrays, strings, null
  const attributes =
    parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  return { attributes, body };
}
```
