import { parse as parseYaml } from "yaml";

const FRONTMATTER_FENCE = "---";

interface ParsedFrontmatter {
  /** Parsed YAML attributes (empty object if no frontmatter found) */
  attributes: Record<string, unknown>;
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
export function parseFrontmatter(
  content: string,
): ParsedFrontmatter {
  const trimmed = content.trimStart();

  if (!trimmed.startsWith(FRONTMATTER_FENCE)) {
    return { attributes: {}, body: content };
  }

  // Find the closing fence (skip the opening "---" line)
  const afterOpening = trimmed.indexOf("\n");
  if (afterOpening === -1) {
    return { attributes: {}, body: content };
  }

  const closingIndex = trimmed.indexOf(
    `\n${FRONTMATTER_FENCE}`,
    afterOpening + 1,
  );
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

  const attributes =
    parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  return { attributes, body };
}
