import { readFileSync } from "node:fs";

import { loadContentFiles } from "../utils/load-content.js";

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
  const loaded = loadContentFiles(vendorDirs, ".md", (filePath, stem) => {
    let body: string;
    try {
      body = readFileSync(filePath, "utf-8");
    } catch (error) {
      throw new Error(`Could not read vendor prompt file: ${filePath}`, { cause: error });
    }

    const trimmed = body.trim();

    if (trimmed.length > MAX_VENDOR_PROMPT_LENGTH) {
      throw new Error(
        `Vendor prompt '${stem}.md' exceeds max length (` +
          `${MAX_VENDOR_PROMPT_LENGTH} chars), skipping.`,
      );
    }

    return trimmed;
  });

  const result = new Map<string, string>();
  for (const [stem, body] of loaded) {
    result.set(stem.toLowerCase(), body);
  }
  return result;
}
