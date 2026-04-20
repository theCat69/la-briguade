import { readdirSync } from "node:fs";

import { logger } from "../runtime/logger.js";
import { isNodeError } from "../support/type-guards.js";

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
    const codeLabel = code ?? "UNKNOWN";
    logger.warn(`Could not read ${label} directory (${codeLabel}): ${dir}`);
    return undefined;
  }
}
