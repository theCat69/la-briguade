import { readdirSync } from "node:fs";

import { isNodeError } from "./type-guards.js";
import { logger } from "./logger.js";

/**
 * Read a directory's entries, returning undefined on failure.
 * Logs a warning with the given label to identify the context.
 */
export function readDirSafe(dir: string, label: string): string[] | undefined {
  try {
    return readdirSync(dir);
  } catch (error) {
    const code = isNodeError(error) ? error.code : undefined;
    if (code === "ENOENT") {
      return undefined;
    }
    logger.warn(`Could not read ${label} directory: ${dir}`);
    return undefined;
  }
}
