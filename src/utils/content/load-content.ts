import { logger } from "../runtime/logger.js";
import { toSanitizedParseFailureReason } from "../support/error-message.js";
import { collectFiles } from "./content-merge.js";

export function loadContentFiles<T>(
  dirs: string[],
  ext: string,
  parse: (filePath: string, stem: string) => T | undefined,
): Map<string, T> {
  const mergedFiles = collectFiles(dirs, ext);
  const loaded = new Map<string, T>();

  for (const [stem, filePath] of mergedFiles) {
    try {
      const parsed = parse(filePath, stem);
      if (parsed === undefined) {
        logger.warn(`skipping ${filePath}: parse returned undefined`);
        continue;
      }
      loaded.set(stem, parsed);
    } catch (error) {
      const sanitizedReason = toSanitizedParseFailureReason(error, 200);
      logger.warn(`skipping ${filePath}: ${sanitizedReason}`);
    }
  }

  return loaded;
}
