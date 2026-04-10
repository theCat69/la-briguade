import { readFileSync } from "node:fs";

import { collectFiles } from "../utils/content-merge.js";

const MAX_VENDOR_PROMPT_LENGTH = 4_000; // chars

/**
 * Load global vendor prompts from content/vendor-prompts/.
 *
 * Each .md file in that directory maps to a model family:
 * the lowercased filename stem (e.g. "claude", "gpt") becomes the key,
 * and the full file content becomes the value.
 *
 * Only regular files are processed — symlinks are skipped to prevent
 * path traversal. Files exceeding MAX_VENDOR_PROMPT_LENGTH chars are
 * also skipped to prevent bloating system calls.
 *
 * @param vendorDirs - Ordered vendor-prompts directories (later overrides earlier)
 * @returns Map of model-family name → vendor prompt text
 */
export function loadVendorPrompts(vendorDirs: string[]): Map<string, string> {
  const result: Map<string, string> = new Map();

  const mergedVendorFiles = collectFiles(vendorDirs, ".md");
  for (const [stem, filePath] of mergedVendorFiles) {
    const key = stem.toLowerCase();

    let body: string;
    try {
      body = readFileSync(filePath, "utf-8");
    } catch {
      console.warn(`[la-briguade] Could not read vendor prompt file: ${filePath}`);
      continue;
    }

    const trimmed = body.trim();

    if (trimmed.length > MAX_VENDOR_PROMPT_LENGTH) {
      console.warn(
        `[la-briguade] Vendor prompt '${stem}.md' exceeds max length (${MAX_VENDOR_PROMPT_LENGTH} chars), skipping.`,
      );
      continue;
    }

    result.set(key, trimmed);
  }

  return result;
}
