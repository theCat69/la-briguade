<!-- Pattern: cli-command — Setting up a Commander.js command with JSONC config editing (install/update commands) -->

```typescript
// src/cli/index.ts — Commander.js CLI with JSONC-safe config mutation.
// Key points to imitate:
//   1. Use jsonc-parser modify() + applyEdits() — never JSON.parse + string replace
//   2. Use isArrayInsertion: true when appending to an existing array
//   3. resolveGlobalConfigPath() uses XDG_CONFIG_HOME with fallback to ~/.config/opencode/opencode.json
//   4. mkdirSync with { recursive: true } inside try-catch — set exitCode + throw on failure
//   5. Report clearly: already installed / installed / created
//   6. The modify() call path mirrors the JSONC key path: ["plugin", index]
//   7. Config key is "plugin" (singular) — per @opencode-ai/plugin Config type
//   8. PLUGIN_ENTRY is "la-briguade@latest" (written on install); isPluginEntry() accepts
//      both "la-briguade" (legacy) and "la-briguade@latest" for backward-compat uninstall/doctor
//   9. update command uses spawnSync with shell:false, 120s timeout, cross-platform npm.cmd on Windows

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { Command } from "commander";
import { parse as parseJsonc, modify, applyEdits } from "jsonc-parser";

const PLUGIN_NAME = "la-briguade";
const PLUGIN_ENTRY = "la-briguade@latest"; // written into opencode.json on install

/** Accept both the legacy bare name and the current @latest entry. */
function isPluginEntry(entry: unknown): boolean {
  return entry === PLUGIN_NAME || entry === PLUGIN_ENTRY;
}

interface ConfigFileResult {
  path: string;
  existed: boolean;
}

/** Resolve the global opencode config path, respecting XDG_CONFIG_HOME. */
function resolveGlobalConfigPath(): string {
  const xdg = process.env["XDG_CONFIG_HOME"];
  const configBase =
    typeof xdg === "string" && xdg.startsWith("/") ? xdg : join(homedir(), ".config");
  return join(configBase, "opencode", "opencode.json");
}

/**
 * Ensure the global opencode config file exists and return its path.
 * Creates parent directories with mkdirSync recursive + try-catch.
 */
function findOrCreateConfigFile(): ConfigFileResult {
  const configPath = resolveGlobalConfigPath();
  const existed = existsSync(configPath);

  try {
    mkdirSync(dirname(configPath), { recursive: true });
  } catch {
    const message =
      `[la-briguade] Cannot create config directory: ${dirname(configPath)}. ` +
      "Check permissions.";
    throw new Error(message);
  }

  if (!existed) {
    writeFileSync(configPath, "{}\n", "utf-8");
  }

  return { path: configPath, existed };
}

/** Read file content, parse as JSONC, and return both raw text and parsed value. */
function readConfig(configPath: string): { raw: string; parsed: Record<string, unknown> } {
  const raw = readFileSync(configPath, "utf-8");
  const parsed = parseJsonc(raw) as Record<string, unknown> | null;
  return { raw, parsed: parsed ?? {} };
}

const program = new Command();

// ---- install ----
program
  .command("install")
  .description("Add la-briguade to your opencode.json plugins list")
  .action(() => {
    let configFileResult: ConfigFileResult;

    try {
      configFileResult = findOrCreateConfigFile();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error while creating global opencode config file.";
      console.error(`[la-briguade] Install failed: ${message}`);
      process.exitCode = 1;
      return;
    }

    const { path: configPath, existed } = configFileResult;
    const { raw, parsed } = readConfig(configPath);

    // Config.plugin per @opencode-ai/plugin Config type — key is "plugin" (singular)
    const plugin = Array.isArray(parsed["plugin"]) ? (parsed["plugin"] as unknown[]) : undefined;

    if (plugin !== undefined && plugin.some(isPluginEntry)) {
      console.log(
        `Already installed — "${plugin.find(isPluginEntry)}" is already in plugin array.`
      );
      return;
    }

    let updated = raw;

    if (plugin === undefined) {
      // No plugin array — create it with the plugin entry
      const edits = modify(updated, ["plugin"], [PLUGIN_ENTRY], {
        formattingOptions: { tabSize: 2, insertSpaces: true },
      });
      updated = applyEdits(updated, edits);
    } else {
      // plugin array exists — append to it
      const edits = modify(updated, ["plugin", plugin.length], PLUGIN_ENTRY, {
        formattingOptions: { tabSize: 2, insertSpaces: true },
        isArrayInsertion: true,
      });
      updated = applyEdits(updated, edits);
    }

    writeFileSync(configPath, updated, "utf-8");

    if (existed) {
      console.log(`Installed — added "${PLUGIN_ENTRY}" to plugin in ${configPath}`);
    } else {
      console.log(`Installed — created ${configPath} with "${PLUGIN_ENTRY}" in plugin`);
    }
  });

// ---- update ----
// Cross-platform: use "npm.cmd" on Windows, "npm" elsewhere.
// spawnSync with shell:false prevents shell injection; 120s timeout guards against hung installs.
program
  .command("update")
  .description("Update la-briguade to the latest version globally")
  .action(() => {
    console.log("[la-briguade] Updating to latest version...");
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

    const result = spawnSync(npmCmd, ["install", "-g", "la-briguade@latest"], {
      stdio: "inherit",
      shell: false,
      timeout: 120_000,
    });

    if (result.error != null) {
      console.error(`[la-briguade] Update failed: ${result.error.message}`);
      process.exitCode = 1;
      return;
    }

    if (result.signal === "SIGTERM") {
      console.error("[la-briguade] Update timed out after 120 seconds.");
      process.exitCode = 1;
      return;
    }

    if (result.status !== 0) {
      console.error(`[la-briguade] Update failed with exit code ${result.status ?? "unknown"}.`);
      process.exitCode = 1;
      return;
    }

    console.log("Updated — la-briguade updated to latest version.");
  });

program.parse();
```
