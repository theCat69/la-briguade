<!-- Pattern: cli-command — Setting up a Commander.js command with JSONC config editing (install command) -->

```typescript
// src/cli/index.ts — Commander.js CLI with JSONC-safe config mutation.
// Key points to imitate:
//   1. Use jsonc-parser modify() + applyEdits() — never JSON.parse + string replace
//   2. Use isArrayInsertion: true when appending to an existing array
//   3. Search CONFIG_CANDIDATES in priority order — first existing file wins
//   4. Report clearly: already installed / installed / created
//   5. The modify() call path mirrors the JSONC key path: ["plugins", index]

import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseJsonc, modify, applyEdits } from "jsonc-parser";

const PLUGIN_NAME = "la-briguade";

/**
 * Candidate config file paths in priority order.
 * The first existing file wins; if none exist, the last entry is used for creation.
 */
const CONFIG_CANDIDATES = [
  ".opencode/opencode.jsonc",
  ".opencode/opencode.json",
  "opencode.jsonc",
  "opencode.json",
] as const;

const program = new Command();

program
  .command("install")
  .description("Add la-briguade to your opencode.json plugins list")
  .action(() => {
    // Find or create config file
    let configPath: string | undefined;
    let existed = false;
    for (const candidate of CONFIG_CANDIDATES) {
      const resolved = resolve(candidate);
      if (existsSync(resolved)) {
        configPath = resolved;
        existed = true;
        break;
      }
    }
    if (configPath === undefined) {
      configPath = resolve("opencode.json");
      writeFileSync(configPath, "{}\n", "utf-8");
    }

    const raw = readFileSync(configPath, "utf-8");
    const parsed = (parseJsonc(raw) ?? {}) as Record<string, unknown>;
    const plugins = Array.isArray(parsed["plugins"])
      ? (parsed["plugins"] as unknown[])
      : undefined;

    if (plugins?.includes(PLUGIN_NAME)) {
      console.log(`Already installed — "${PLUGIN_NAME}" is already in plugins array.`);
      return;
    }

    let updated = raw;

    if (plugins === undefined) {
      // No plugins array — create it
      const edits = modify(updated, ["plugins"], [PLUGIN_NAME], {
        formattingOptions: { tabSize: 2, insertSpaces: true },
      });
      updated = applyEdits(updated, edits);
    } else {
      // Append to existing array
      const edits = modify(updated, ["plugins", plugins.length], PLUGIN_NAME, {
        formattingOptions: { tabSize: 2, insertSpaces: true },
        isArrayInsertion: true,
      });
      updated = applyEdits(updated, edits);
    }

    writeFileSync(configPath, updated, "utf-8");

    if (existed) {
      console.log(`Installed — added "${PLUGIN_NAME}" to plugins in ${configPath}`);
    } else {
      console.log(`Installed — created ${configPath} with "${PLUGIN_NAME}" in plugins`);
    }
  });

program.parse();
```
