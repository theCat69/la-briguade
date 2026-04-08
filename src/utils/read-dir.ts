import { readdirSync } from "node:fs";

/**
 * Read a directory's entries, returning undefined on failure.
 * Logs a warning with the given label to identify the context.
 */
export function readDirSafe(dir: string, label: string): string[] | undefined {
  try {
    return readdirSync(dir);
  } catch {
    console.warn(`[la-briguade] Could not read ${label} directory: ${dir}`);
    return undefined;
  }
}
