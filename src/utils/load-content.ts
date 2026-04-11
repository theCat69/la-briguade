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
        console.warn(`[la-briguade] skipping ${filePath}: parse returned undefined`);
        continue;
      }
      loaded.set(stem, parsed);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown parse error";
      const sanitizedReason = String(reason)
        .replace(/[^\x20-\x7E]/g, "?")
        .slice(0, 200);
      console.warn(`[la-briguade] skipping ${filePath}: ${sanitizedReason}`);
    }
  }

  return loaded;
}
