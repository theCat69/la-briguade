import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
} from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { Command } from "commander";
import { parse as parseJsonc, modify, applyEdits } from "jsonc-parser";

import { resolveUserConfig } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { isRecord } from "../utils/type-guards.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rawPkg: unknown = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8"));
const pkg = isRecord(rawPkg) ? rawPkg : {};

const PLUGIN_NAME = "la-briguade";

interface ConfigFileResult {
  path: string;
  existed: boolean;
}

function resolveGlobalConfigPath(): string {
  const xdg = process.env["XDG_CONFIG_HOME"];
  const configBase =
    typeof xdg === "string" && xdg.startsWith("/") ? xdg : join(homedir(), ".config");
  return join(configBase, "opencode", "opencode.json");
}

/**
 * Ensure the global opencode config file exists and return its path.
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
    console.error(message);
    throw new Error(message);
  }

  if (!existed) {
    writeFileSync(configPath, "{}\n", "utf-8");
  }

  return { path: configPath, existed };
}

/**
 * Find an existing global opencode config file.
 */
function findConfigFile(): string | undefined {
  const configPath = resolveGlobalConfigPath();
  return existsSync(configPath) ? configPath : undefined;
}

/**
 * Read file content, parse as JSONC, and return both raw text and parsed value.
 */
function readConfig(configPath: string): { raw: string; parsed: Record<string, unknown> } {
  const raw = readFileSync(configPath, "utf-8");
  const value: unknown = parseJsonc(raw);
  const parsed = isRecord(value) ? value : {};
  return { raw, parsed };
}

// ---------------------------------------------------------------------------
// CLI definition
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name("la-briguade")
  .description("CLI for the la-briguade opencode plugin")
  .version(String(pkg["version"] ?? "0.0.0"));

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
    let configData: ReturnType<typeof readConfig>;
    try {
      configData = readConfig(configPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[la-briguade] Could not read config file: ${message}`);
      process.exitCode = 1;
      return;
    }
    const { raw, parsed } = configData;

    // Config.plugin per @opencode-ai/plugin Config type
    const plugin = Array.isArray(parsed["plugin"]) ? parsed["plugin"] : undefined;

    if (plugin !== undefined && plugin.includes(PLUGIN_NAME)) {
      console.log(`Already installed — "${PLUGIN_NAME}" is already in plugin array.`);
      return;
    }

    // Use jsonc-parser modify() to safely edit JSONC (preserves comments)
    let updated = raw;

    if (plugin === undefined) {
      // No plugin array — create it with the plugin entry
      const edits = modify(updated, ["plugin"], [PLUGIN_NAME], {
        formattingOptions: { tabSize: 2, insertSpaces: true },
      });
      updated = applyEdits(updated, edits);
    } else {
      // plugin array exists — append to it
      const edits = modify(updated, ["plugin", plugin.length], PLUGIN_NAME, {
        formattingOptions: { tabSize: 2, insertSpaces: true },
        isArrayInsertion: true,
      });
      updated = applyEdits(updated, edits);
    }

    try {
      writeFileSync(configPath, updated, "utf-8");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[la-briguade] Could not write config file: ${message}`);
      process.exitCode = 1;
      return;
    }

    if (existed) {
      console.log(`Installed — added "${PLUGIN_NAME}" to plugin in ${configPath}`);
    } else {
      console.log(`Installed — created ${configPath} with "${PLUGIN_NAME}" in plugin`);
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

    let configData: ReturnType<typeof readConfig>;
    try {
      configData = readConfig(configPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[la-briguade] Could not read config file: ${message}`);
      process.exitCode = 1;
      return;
    }
    const { raw, parsed } = configData;
    const plugin = Array.isArray(parsed["plugin"]) ? parsed["plugin"] : undefined;

    if (plugin === undefined) {
      console.log(`Not installed — no plugin array in ${configPath}`);
      return;
    }

    const index = plugin.indexOf(PLUGIN_NAME);
    if (index === -1) {
      console.log(`Not installed — "${PLUGIN_NAME}" not found in plugin array.`);
      return;
    }

    const edits = modify(raw, ["plugin", index], undefined, {
      formattingOptions: { tabSize: 2, insertSpaces: true },
    });
    const updated = applyEdits(raw, edits);
    try {
      writeFileSync(configPath, updated, "utf-8");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[la-briguade] Could not write config file: ${message}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Uninstalled — removed "${PLUGIN_NAME}" from plugin in ${configPath}`);
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
        ? `${counts["agents"] ?? 0} agents, ${counts["skills"] ?? 0} skills, ` +
          `${counts["commands"] ?? 0} commands found`
        : `Missing or incomplete: ${contentDir}`,
    });

    // 3. opencode config has la-briguade in plugin
    const globalConfigPath = resolveGlobalConfigPath();
    if (!existsSync(globalConfigPath)) {
      checks.push({
        label: "Plugin registered",
        ok: false,
        detail: `Global config not found at ${globalConfigPath} — run: la-briguade install`,
      });
    } else {
      let configData: ReturnType<typeof readConfig>;
      try {
        configData = readConfig(globalConfigPath);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[la-briguade] Could not read config file: ${message}`);
        process.exitCode = 1;
        return;
      }
      const { parsed } = configData;
      const plugin = Array.isArray(parsed["plugin"]) ? parsed["plugin"] : [];
      const hasPlugin = plugin.includes(PLUGIN_NAME);

      checks.push({
        label: "Plugin registered",
        ok: hasPlugin,
        detail: hasPlugin
          ? `Found in ${globalConfigPath}`
          : `"${PLUGIN_NAME}" not in plugin array in ${globalConfigPath}`,
      });
    }

    // 4. effective logger configuration
    const userConfig = resolveUserConfig(process.cwd());
    const logLevel = userConfig.log_level ?? "warn";
    const logFilePath = logger.getLogFilePath() ?? "not initialized";

    checks.push({
      label: "Log level",
      ok: true,
      detail: logLevel,
    });
    checks.push({
      label: "Log file",
      ok: true,
      detail: logFilePath,
    });

    // 5. cache-ctrl peer dependency
    const cacheCtrlModuleName = "cache-ctrl";
    try {
      await import(cacheCtrlModuleName);
      checks.push({ label: "cache-ctrl", ok: true, detail: "Peer dependency available" });
    } catch {
      checks.push({
        label: "cache-ctrl",
        ok: false,
        detail: "Cannot import cache-ctrl (optional peer)",
      });
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
