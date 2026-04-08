import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { parse as parseJsonc, modify, applyEdits } from "jsonc-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf-8"),
) as { version: string };

const PLUGIN_NAME = "la-briguade";

/**
 * Candidate config file paths in priority order.
 * The first existing file wins; if none exist, the last entry is used for creation.
 */
const CONFIG_CANDIDATES = [
  join(".opencode", "opencode.jsonc"),
  join(".opencode", "opencode.json"),
  "opencode.jsonc",
  "opencode.json",
] as const;

interface ConfigFileResult {
  path: string;
  existed: boolean;
}

/**
 * Find the opencode config file by searching candidates in priority order.
 * Returns the first existing file, or creates `opencode.json` at the project root.
 */
function findOrCreateConfigFile(): ConfigFileResult {
  for (const candidate of CONFIG_CANDIDATES) {
    const resolved = resolve(candidate);
    if (existsSync(resolved)) {
      return { path: resolved, existed: true };
    }
  }

  const fallback = resolve("opencode.json");
  writeFileSync(fallback, "{}\n", "utf-8");
  return { path: fallback, existed: false };
}

/**
 * Find an existing opencode config file.
 * Returns undefined if no config file exists.
 */
function findConfigFile(): string | undefined {
  for (const candidate of CONFIG_CANDIDATES) {
    const resolved = resolve(candidate);
    if (existsSync(resolved)) {
      return resolved;
    }
  }
  return undefined;
}

/**
 * Read file content, parse as JSONC, and return both raw text and parsed value.
 */
function readConfig(configPath: string): { raw: string; parsed: Record<string, unknown> } {
  const raw = readFileSync(configPath, "utf-8");
  const parsed = parseJsonc(raw) as Record<string, unknown> | null;
  return { raw, parsed: parsed ?? {} };
}

// ---------------------------------------------------------------------------
// CLI definition
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name("la-briguade")
  .description("CLI for the la-briguade opencode plugin")
  .version(pkg.version);

// ---- install ----
program
  .command("install")
  .description("Add la-briguade to your opencode.json plugins list")
  .action(() => {
    const { path: configPath, existed } = findOrCreateConfigFile();
    const { raw, parsed } = readConfig(configPath);

    const plugins = Array.isArray(parsed["plugins"]) ? parsed["plugins"] as unknown[] : undefined;

    if (plugins?.includes(PLUGIN_NAME)) {
      console.log(`Already installed — "${PLUGIN_NAME}" is already in plugins array.`);
      return;
    }

    // Use jsonc-parser modify() to safely edit JSONC (preserves comments)
    let updated = raw;

    if (plugins === undefined) {
      // No plugins array — create it with the plugin entry
      const edits = modify(updated, ["plugins"], [PLUGIN_NAME], {
        formattingOptions: { tabSize: 2, insertSpaces: true },
      });
      updated = applyEdits(updated, edits);
    } else {
      // plugins array exists — append to it
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

// ---- uninstall ----
program
  .command("uninstall")
  .description("Remove la-briguade from your opencode.json plugins list")
  .action(() => {
    const configPath = findConfigFile();

    if (configPath === undefined) {
      console.log("Not installed — no opencode config file found.");
      return;
    }

    const { raw, parsed } = readConfig(configPath);
    const plugins = Array.isArray(parsed["plugins"]) ? parsed["plugins"] as unknown[] : undefined;

    if (plugins === undefined) {
      console.log(`Not installed — no plugins array in ${configPath}`);
      return;
    }

    const index = plugins.indexOf(PLUGIN_NAME);
    if (index === -1) {
      console.log(`Not installed — "${PLUGIN_NAME}" not found in plugins array.`);
      return;
    }

    const edits = modify(raw, ["plugins", index], undefined, {
      formattingOptions: { tabSize: 2, insertSpaces: true },
    });
    const updated = applyEdits(raw, edits);
    writeFileSync(configPath, updated, "utf-8");

    console.log(`Uninstalled — removed "${PLUGIN_NAME}" from plugins in ${configPath}`);
  });

// ---- doctor ----
program
  .command("doctor")
  .description("Verify la-briguade installation and diagnose issues")
  .action(async () => {
    interface CheckResult {
      label: string;
      ok: boolean;
      detail: string;
    }

    const checks: CheckResult[] = [];

    // 1. Plugin package importable
    // Dynamic module name avoids TS2307 — these are runtime probes, not build-time deps
    const pluginModuleName = "la-briguade";
    try {
      await import(pluginModuleName);
      checks.push({ label: "Plugin package", ok: true, detail: "la-briguade importable" });
    } catch {
      checks.push({ label: "Plugin package", ok: false, detail: "Cannot import la-briguade" });
    }

    // 2. Content directory exists with agents/skills/commands
    const contentDir = resolve(__dirname, "../../content");
    const subdirs = ["agents", "skills", "commands"] as const;
    const counts: Record<string, number> = {};

    let contentOk = existsSync(contentDir);
    for (const sub of subdirs) {
      const subPath = resolve(contentDir, sub);
      if (existsSync(subPath)) {
        try {
          const entries = readdirSync(subPath);
          if (sub === "skills") {
            // Count directories (each skill is a subdirectory)
            counts[sub] = entries.filter((e) => {
              try {
                return statSync(resolve(subPath, e)).isDirectory();
              } catch {
                return false;
              }
            }).length;
          } else {
            // Count .md files (exclude .gitkeep)
            counts[sub] = entries.filter((e) => e.endsWith(".md")).length;
          }
        } catch {
          counts[sub] = 0;
          contentOk = false;
        }
      } else {
        counts[sub] = 0;
        contentOk = false;
      }
    }

    checks.push({
      label: "Content directory",
      ok: contentOk,
      detail: contentOk
        ? `${counts["agents"] ?? 0} agents, ${counts["skills"] ?? 0} skills, ${counts["commands"] ?? 0} commands found`
        : `Missing or incomplete: ${contentDir}`,
    });

    // 3. opencode config has la-briguade in plugins
    const configPath = findConfigFile();
    if (configPath !== undefined) {
      const { parsed } = readConfig(configPath);
      const plugins = Array.isArray(parsed["plugins"]) ? parsed["plugins"] as unknown[] : [];
      const hasPlugin = plugins.includes(PLUGIN_NAME);

      checks.push({
        label: "Plugin registered",
        ok: hasPlugin,
        detail: hasPlugin
          ? `Found in ${configPath}`
          : `"${PLUGIN_NAME}" not in plugins array (${configPath})`,
      });
    } else {
      checks.push({
        label: "Plugin registered",
        ok: false,
        detail: "No opencode config file found",
      });
    }

    // 4. cache-ctrl peer dependency
    const cacheCtrlModuleName = "cache-ctrl";
    try {
      await import(cacheCtrlModuleName);
      checks.push({ label: "cache-ctrl", ok: true, detail: "Peer dependency available" });
    } catch {
      checks.push({ label: "cache-ctrl", ok: false, detail: "Cannot import cache-ctrl (optional peer)" });
    }

    // Print summary table
    console.log("\nla-briguade doctor\n");
    const maxLabel = Math.max(...checks.map((c) => c.label.length));

    for (const check of checks) {
      const icon = check.ok ? "\u2705" : "\u274C";
      const paddedLabel = check.label.padEnd(maxLabel);
      console.log(`  ${icon} ${paddedLabel}  ${check.detail}`);
    }

    console.log();

    const failCount = checks.filter((c) => !c.ok).length;
    if (failCount > 0) {
      console.log(`${failCount} issue${failCount > 1 ? "s" : ""} found.`);
      process.exitCode = 1;
    } else {
      console.log("All checks passed.");
    }
  });

program.parse();
