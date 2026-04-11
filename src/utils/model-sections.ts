import { logger } from "./logger.js";

/** Ordered list of recognised model-family identifiers used to match section headers. */
export const KNOWN_FAMILIES = ["claude", "gpt", "gemini", "grok"] as const;

/** A single model-family name derived from {@link KNOWN_FAMILIES}. */
export type ModelFamily = (typeof KNOWN_FAMILIES)[number];

/**
 * Parsed representation of an agent body that may contain model-family-specific sections.
 *
 * - `base` — prompt text that precedes the first section header (applies to all models)
 * - `sections` — per-family prompt additions keyed by {@link ModelFamily}
 */
export type ModelSections = {
  base: string;
  sections: Partial<Record<ModelFamily, string>>;
};

/**
 * Matches a section header line of the form: `====== FAMILY ======`
 * - Requires 4 or more `=` signs on each side
 * - Allows optional surrounding whitespace
 * - Captures the family name in group 1
 * - Case-insensitive, multiline
 */
const SECTION_HEADER_RE = /^={4,}\s*(\w+)\s*={4,}\s*$/im;

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
 * ====== GPT ======
 * GPT-specific additions...
 * ```
 *
 * Rules:
 * - Everything before the first section header is the `base`
 * - Each section runs from its header line to the next header (exclusive) or end of body
 * - The header line itself is not included in the section text
 * - Both base and section texts are trimmed
 * - Unknown family names produce a logger warning and are skipped
 *
 * @param body - The raw agent body text (after frontmatter has been stripped)
 * @returns Parsed base prompt and per-family section map
 */
export function parseModelSections(body: string): ModelSections {
  // Split body on section header lines, keeping separators
  const parts = body.split(SECTION_HEADER_RE);

  // When there are no headers, split returns the original string in a single-element array
  if (parts.length === 1) {
    return { base: body.trim(), sections: {} };
  }

  // With n headers, split produces: [before, cap1, after1, cap2, after2, ...]
  // parts[0] = text before first header
  // parts[1] = first captured family name
  // parts[2] = text after first header (until next header or end)
  // parts[3] = second captured family name (if present)
  // ...etc
  const base = (parts[0] ?? "").trim();
  const sections: Partial<Record<ModelFamily, string>> = {};

  for (let i = 1; i + 1 < parts.length; i += 2) {
    const rawFamily = parts[i] ?? "";
    const sectionText = parts[i + 1] ?? "";
    const family = rawFamily.toLowerCase();

    if (!(KNOWN_FAMILIES as readonly string[]).includes(family)) {
      logger.warn(`unknown model section family: '${family}' in agent body — skipped`);
      continue;
    }

    sections[family as ModelFamily] = sectionText.trim();
  }

  return { base, sections };
}

/**
 * Resolve the best-matching model-specific section for a given model ID.
 *
 * Matching order:
 * 1. Iterate KNOWN_FAMILIES in order; return first family whose name appears in `modelId`
 * 2. Fallback: return `sections["claude"]` if present
 * 3. Return `undefined` if no match and no claude fallback
 *
 * @param sections - Per-family section map from `parseModelSections`
 * @param modelId - The full model identifier (e.g. `"github-copilot/claude-sonnet-4-6"`)
 * @returns The section text, or undefined if nothing matches
 */
export function resolveModelSection(
  sections: Partial<Record<ModelFamily, string>>,
  modelId: string,
): string | undefined {
  const normalizedId = modelId.toLowerCase();

  for (const family of KNOWN_FAMILIES) {
    if (normalizedId.includes(family)) {
      const text = sections[family];
      // Guard against empty-string entries — treat them as absent
      if (text !== undefined && text.length > 0) return text;
    }
  }

  // No direct match — fall back to claude section if present and non-empty
  const claudeText = sections["claude"];
  return claudeText !== undefined && claudeText.length > 0 ? claudeText : undefined;
}
