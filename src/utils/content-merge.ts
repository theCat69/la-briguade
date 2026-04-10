import { statSync } from "node:fs";
import { basename, join } from "node:path";

import { readDirSafe } from "./read-dir.js";

/**
 * Collects files matching `extension` from each dir in `dirs` (in order).
 * Returns a Map<stem, fullPath> where later dirs override earlier ones with the same stem.
 * Silently skips dirs that don't exist or can't be read.
 * @param extension - include the dot, e.g. '.md'
 */
export function collectFiles(dirs: string[], extension: string): Map<string, string> {
  const merged: Map<string, string> = new Map();

  for (const dir of dirs) {
    const entries = readDirSafe(dir, "content-files");
    if (entries === undefined) continue;

    for (const entry of entries) {
      if (!entry.endsWith(extension)) continue;
      const stem = basename(entry, extension);
      merged.set(stem, join(dir, entry));
    }
  }

  return merged;
}

/**
 * Collects immediate subdirectories from each root in `roots` (in order).
 * Returns a Map<dirName, fullPath> where later roots override earlier ones with the same name.
 * Silently skips roots that don't exist.
 */
export function collectDirs(roots: string[]): Map<string, string> {
  const merged: Map<string, string> = new Map();

  for (const root of roots) {
    const entries = readDirSafe(root, "content-dirs");
    if (entries === undefined) continue;

    for (const entry of entries) {
      const fullPath = join(root, entry);
      try {
        if (statSync(fullPath).isDirectory()) {
          const safeDirName = basename(entry);
          merged.set(safeDirName, fullPath);
        }
      } catch {
        // Ignore unreadable/missing entries.
      }
    }
  }

  return merged;
}
