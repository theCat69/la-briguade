import { logger } from "./logger.js";

/** Ordered list of recognised model-family identifiers used to match section headers. */
export const KNOWN_FAMILIES = ["claude", "gpt", "gemini", "grok"] as const;

/** A single model-family name derived from {@link KNOWN_FAMILIES}. */
export type ModelFamily = (typeof KNOWN_FAMILIES)[number];

/** Section target can be a specific family or explicit all-model segment. */
export type SectionTarget = ModelFamily | "all";

/** One ordered segment parsed from a section header and its trailing text. */
export type ModelSegment = {
  target: SectionTarget;
  text: string;
};

/**
 * Parsed representation of an agent body that may contain model-family-specific sections.
 *
 * - `base` — prompt text that precedes the first section header (applies to all models)
 * - `segments` — ordered model-targeted additions in document order
 */
export type ModelSections = {
  base: string;
  segments: ModelSegment[];
};

/**
 * Matches a section header line of the form: `====== FAMILY ======`
 * - Requires 4 or more `=` signs on each side
 * - Allows optional surrounding whitespace
 * - Captures the family name in group 1
 * - Case-insensitive, multiline
 */
const SECTION_HEADER_RE = /^={4,}\s*(\w+)\s*={4,}\s*$/im;
const MAX_SEGMENTS = 50;

/**
 * Parse a markdown agent body that may contain model-family-specific sections.
 *
 * Section syntax:
 * ```
 * Base prompt text...
 *
 * ====== CLAUDE ======
 * Claude-specific additions...
 *
 * ====== ALL ======
 * Shared additions for every model...
 *
 * ====== GPT ======
 * GPT-specific additions...
 * ```
 *
 * Rules:
 * - Everything before the first section header is the `base`
 * - Each section runs from its header line to the next header (exclusive) or end of body
 * - The header line itself is not included in the section text
 * - Both base and section texts are trimmed
 * - `ALL` is a special target — that segment is included for every model
 * - Multiple sections with the same target are allowed; all are retained in document order
 * - At most {@link MAX_SEGMENTS} segments are parsed; excess sections are skipped with a warning
 * - Unknown family names produce a logger warning and are skipped
 *
 * @param body - The raw agent body text (after frontmatter has been stripped)
 * @returns Parsed base prompt and ordered model-targeted segments
 */
export function parseModelSections(body: string): ModelSections {
  // Split body on section header lines, keeping separators
  const parts = body.split(SECTION_HEADER_RE);

  // When there are no headers, split returns the original string in a single-element array
  if (parts.length === 1) {
    return { base: body.trim(), segments: [] };
  }

  // With n headers, split produces: [before, cap1, after1, cap2, after2, ...]
  // parts[0] = text before first header
  // parts[1] = first captured family name
  // parts[2] = text after first header (until next header or end)
  // parts[3] = second captured family name (if present)
  // ...etc
  const base = (parts[0] ?? "").trim();
  const segments: ModelSegment[] = [];

  for (let i = 1; i + 1 < parts.length; i += 2) {
    if (segments.length >= MAX_SEGMENTS) {
      logger.warn(
        `model section count exceeded MAX_SEGMENTS=${MAX_SEGMENTS}; remaining sections skipped`,
      );
      break;
    }

    const rawFamily = parts[i] ?? "";
    const sectionText = parts[i + 1] ?? "";
    const target = rawFamily.toLowerCase();

    const isKnownFamily = (KNOWN_FAMILIES as readonly string[]).includes(target);
    if (!isKnownFamily && target !== "all") {
      logger.warn(`unknown model section family: '${target}' in agent body — skipped`);
      continue;
    }

    segments.push({
      target: target as SectionTarget,
      text: sectionText.trim(),
    });
  }

  return { base, segments };
}

/**
 * Resolve ordered model-specific segments for a given model ID.
 *
 * Resolution rules:
 * 1. Determine matched family by scanning KNOWN_FAMILIES in order
 * 2. Include segments in document order when target is `all` or matched family
 * 3. Join non-empty trimmed matches with two newlines
 * 4. Claude fallback: only when model family is **unknown** (no substring match in KNOWN_FAMILIES)
 *    **and** no `all` segment exists anywhere in the list. If the family was recognised but
 *    produced no non-empty text (e.g. empty section body), the fallback is suppressed.
 *
 * @param segments - Ordered segment list from `parseModelSections`
 * @param modelId - The full model identifier (e.g. `"github-copilot/claude-sonnet-4-6"`)
 * @returns Joined section text, or undefined if nothing matches
 */
export function resolveModelSection(
  segments: ModelSegment[],
  modelId: string,
): string | undefined {
  const normalizedId = modelId.toLowerCase();
  const matchedFamily = KNOWN_FAMILIES.find((family) => normalizedId.includes(family));

  const resolved = segments
    .filter((segment) => segment.target === "all" || segment.target === matchedFamily)
    .map((segment) => segment.text.trim())
    .filter((text) => text.length > 0)
    .join("\n\n");

  if (resolved.length > 0) {
    return resolved;
  }

  const hasAllSegment = segments.some((segment) => segment.target === "all");
  if (matchedFamily !== undefined || hasAllSegment) {
    return undefined;
  }

  const claudeSegment = segments.find((segment) => segment.target === "claude");
  const trimmedClaudeText = claudeSegment?.text.trim();
  return trimmedClaudeText !== undefined && trimmedClaudeText.length > 0
    ? trimmedClaudeText
    : undefined;
}
