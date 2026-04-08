import { parse as parseYaml } from "yaml";

const FRONTMATTER_FENCE = "---";

interface ParsedFrontmatter<T> {
  /** Parsed YAML attributes (empty object if no frontmatter found) */
  attributes: T;
  /** Markdown body after the frontmatter block */
  body: string;
}

/**
 * Parse YAML frontmatter from a markdown string.
 *
 * Handles the complex nested permission structures used in agent .md files:
 * ```yaml
 * permission:
 *   "*": "deny"
 *   edit: "allow"
 *   bash: "allow"
 *   skill:
 *     "*": "deny"
 *     "project-coding": "allow"
 * ```
 *
 * @param content - Raw markdown file content (string)
 * @returns Parsed frontmatter attributes and the remaining body
 */
export function parseFrontmatter<T = Record<string, unknown>>(
  content: string,
): ParsedFrontmatter<T> {
  const trimmed = content.trimStart();

  if (!trimmed.startsWith(FRONTMATTER_FENCE)) {
    return { attributes: {} as T, body: content };
  }

  // Find the closing fence (skip the opening "---" line)
  const afterOpening = trimmed.indexOf("\n");
  if (afterOpening === -1) {
    return { attributes: {} as T, body: content };
  }

  const closingIndex = trimmed.indexOf(
    `\n${FRONTMATTER_FENCE}`,
    afterOpening + 1,
  );
  if (closingIndex === -1) {
    return { attributes: {} as T, body: content };
  }

  const yamlBlock = trimmed.slice(afterOpening + 1, closingIndex);
  const bodyStart = closingIndex + 1 + FRONTMATTER_FENCE.length;

  // Skip optional newline after closing fence
  const body = trimmed[bodyStart] === "\n"
    ? trimmed.slice(bodyStart + 1)
    : trimmed.slice(bodyStart);

  const attributes = parseYaml(yamlBlock) as T;

  return {
    attributes: attributes ?? ({} as T),
    body,
  };
}
