<!-- Pattern: content-override-merge — Merge layered content directories with deterministic last-wins precedence -->

```typescript
// src/utils/content-merge.ts — Shared helper used by agents/commands/vendors/skills loaders.
// Key points:
//   1. Input directories are ordered by precedence — builtin first, user overrides last
//   2. Later directories override earlier ones by key (filename stem or subdir name)
//   3. Missing/unreadable roots are skipped safely using readDirSafe()
//
// Caller example (src/index.ts) — actual priority chain (last-wins):
//   Agents/Commands/Vendors:
//     [builtinDir, ~/la_briguade/<type>/, <root>/.la_briguade/<type>/]
//   Skills:
//     [builtinSkillsDir, ~/.config/opencode/skills/, ~/la_briguade/skills/,
//      <root>/.opencode/skills/, <root>/.la_briguade/skills/]

import { statSync } from "node:fs";
import { basename, join } from "node:path";

import { readDirSafe } from "./read-dir.js";

// collectFiles: used by agents, commands, and vendor-prompts loaders.
// Returns Map<stem, fullPath> — later dirs win for the same stem.
export function collectFiles(dirs: string[], extension: string): Map<string, string> {
  const merged = new Map<string, string>();

  for (const dir of dirs) {
    const entries = readDirSafe(dir, "content-files");
    if (entries === undefined) continue;

    for (const entry of entries) {
      if (!entry.endsWith(extension)) continue;
      merged.set(basename(entry, extension), join(dir, entry));
    }
  }

  return merged; // later set() calls replace earlier paths for the same key
}

// collectDirs: used by the skills loader.
// Returns Map<dirName, fullPath> — later roots win for the same subdir name.
export function collectDirs(roots: string[]): Map<string, string> {
  const merged = new Map<string, string>();

  for (const root of roots) {
    const entries = readDirSafe(root, "content-dirs");
    if (entries === undefined) continue;

    for (const entry of entries) {
      const fullPath = join(root, entry);
      try {
        if (statSync(fullPath).isDirectory()) {
          merged.set(basename(entry), fullPath);
        }
      } catch {
        // Ignore unreadable/missing entries.
      }
    }
  }

  return merged;
}
```
