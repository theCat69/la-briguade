import { readdirSync, readFileSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join, basename } from "node:path";

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
 * @param contentDir - Absolute path to the content/ directory
 * @returns Map of model-family name → vendor prompt text
 */
export function loadVendorPrompts(contentDir: string): Map<string, string> {
  const vendorPromptsDir = join(contentDir, "vendor-prompts");
  const result: Map<string, string> = new Map();

  let entries: Dirent[];
  try {
    entries = readdirSync(vendorPromptsDir, { withFileTypes: true });
  } catch {
    return result; // dir doesn't exist or isn't readable
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

    const filePath = join(vendorPromptsDir, entry.name);
    const key = basename(entry.name, ".md").toLowerCase();

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
        `[la-briguade] Vendor prompt '${entry.name}' exceeds max length (${MAX_VENDOR_PROMPT_LENGTH} chars), skipping.`,
      );
      continue;
    }

    result.set(key, trimmed);
  }

  return result;
}
