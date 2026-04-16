import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { z } from "zod";

import { parseFrontmatter } from "../utils/frontmatter.js";
import { isNodeError, isRecord } from "../utils/type-guards.js";
import { logger } from "../utils/logger.js";
import type { Config } from "../types/plugin.js";

// ─── Schemas ────────────────────────────────────────────────────────────────

const DetectContentEntrySchema = z.object({
  file: z.string(),
  contains: z.string(),
});

const DetectSchema = z.object({
  files: z.array(z.string()).optional(),
  content: z.array(DetectContentEntrySchema).optional(),
});

const AutoInjectFrontmatterSchema = z.object({
  agents: z.array(z.string()).optional(),
  detect: DetectSchema.optional(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single auto-inject skill entry, parsed from a SKILL.md file. */
export type AutoInjectEntry = {
  skillName: string;
  /** Raw markdown body (after frontmatter) to append to matching agent prompts. */
  body: string;
  /** Agent names this skill should be injected into (from `agents:` frontmatter). */
  agents: string[];
  /** Files that must exist in projectDir for this skill to be active (OR logic). */
  detectFiles: string[];
  /** File+content pairs that activate the skill when matched (OR logic). */
  detectContent: Array<{ file: string; contains: string }>;
};

// ─── Collect ─────────────────────────────────────────────────────────────────

/**
 * Read each auto-inject skill directory, parse its SKILL.md frontmatter and body,
 * and return a map from skill name to entry.
 *
 * Skips dirs where SKILL.md is absent (ENOENT). Warns and skips on other read
 * errors or invalid frontmatter.
 *
 * @param skillDirs - Full paths to individual skill subdirectories
 *   (e.g. `/content/auto-inject-skills/general-coding`)
 */
export function collectAutoInjectSkills(skillDirs: string[]): Map<string, AutoInjectEntry> {
  const entries = new Map<string, AutoInjectEntry>();

  for (const skillDir of skillDirs) {
    const skillName = basename(skillDir);
    const skillFilePath = join(skillDir, "SKILL.md");

    let rawContent: string;
    try {
      rawContent = readFileSync(skillFilePath, "utf8");
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") {
        logger.warn(
          `Could not read auto-inject skill file: ${skillFilePath} ` +
          `(${error instanceof Error ? error.message : String(error)})`,
        );
      }
      continue;
    }

    const { attributes, body } = parseFrontmatter(rawContent);

    const parsed = AutoInjectFrontmatterSchema.safeParse(attributes);
    if (!parsed.success) {
      logger.warn(`Invalid auto-inject skill frontmatter in: ${skillFilePath}`);
      continue;
    }

    const { agents = [], detect } = parsed.data;

    entries.set(skillName, {
      skillName,
      body: body.trim(),
      agents,
      detectFiles: detect?.files ?? [],
      detectContent: detect?.content ?? [],
    });
  }

  return entries;
}

// ─── Resolve ─────────────────────────────────────────────────────────────────

/**
 * Determine which auto-inject skills are active for the given project directory.
 *
 * A skill with no `detect` constraints is always active. A skill with
 * `detect.files` is active if any listed file exists (OR logic). A skill with
 * `detect.content` is active if any listed entry has a file that exists and
 * contains the specified substring (OR logic).
 *
 * @param entries - Collected auto-inject entries (from `collectAutoInjectSkills`)
 * @param projectDir - Absolute path to the project root to check file existence
 */
export function resolveActiveSkills(
  entries: Map<string, AutoInjectEntry>,
  projectDir: string,
): Set<string> {
  const active = new Set<string>();

  for (const [skillName, entry] of entries) {
    // No detect constraints → always active
    if (entry.detectFiles.length === 0 && entry.detectContent.length === 0) {
      active.add(skillName);
      continue;
    }

    // detect.files: any matching file existing → active (OR logic)
    for (const file of entry.detectFiles) {
      if (existsSync(join(projectDir, file))) {
        active.add(skillName);
        break;
      }
    }

    if (active.has(skillName)) {
      continue;
    }

    // detect.content: any entry whose file exists and contains the substring → active (OR logic)
    for (const { file, contains } of entry.detectContent) {
      const filePath = join(projectDir, file);
      if (!existsSync(filePath)) {
        continue;
      }
      try {
        const content = readFileSync(filePath, "utf8");
        if (content.includes(contains)) {
          active.add(skillName);
          break;
        }
      } catch {
        // Unreadable file is not treated as active for this entry
      }
    }
  }

  return active;
}

// ─── Inject ──────────────────────────────────────────────────────────────────

/**
 * Append each active auto-inject skill body to matching agent prompts.
 *
 * A skill is injected into an agent if:
 *  - The skill's `agents:` list includes the agent name, OR
 *  - The agent has an explicit `permission.skill["<skillName>"] = "allow" | "ask"`
 *
 * Wildcards (`"*"`) do NOT trigger injection — explicit authorization only.
 * Must be called after `injectSkillAgentPermissions` so that `permission.skill`
 * entries set via `agents:` opt-in are already present.
 *
 * @param input - The mutable plugin config object
 * @param entries - Collected auto-inject entries
 * @param activeSkills - Set of skill names active for the current project
 */
export function injectAutoInjectSkills(
  input: Config,
  entries: Map<string, AutoInjectEntry>,
  activeSkills: Set<string>,
): void {
  if (!isRecord(input.agent)) {
    return;
  }

  for (const [agentName, agentConfig] of Object.entries(input.agent)) {
    if (!isRecord(agentConfig)) {
      continue;
    }

    // Resolve explicit skill permissions for this agent (no wildcard)
    const rawPermission: unknown = agentConfig["permission"];
    const rawSkillPerms: Record<string, unknown> =
      isRecord(rawPermission) && isRecord(rawPermission["skill"])
        ? rawPermission["skill"]
        : {};

    for (const [skillName, entry] of entries) {
      if (!activeSkills.has(skillName)) {
        continue;
      }

      if (entry.body.length === 0) {
        continue;
      }

      // Authorize: skill's agents list OR explicit allow/ask (no wildcard)
      const inAgentsList = entry.agents.includes(agentName);
      const explicitPerm = rawSkillPerms[skillName];
      const hasExplicitPermission = explicitPerm === "allow" || explicitPerm === "ask";

      if (!inAgentsList && !hasExplicitPermission) {
        continue;
      }

      const existingPrompt = agentConfig["prompt"];
      const promptStr = typeof existingPrompt === "string" ? existingPrompt : "";
      agentConfig["prompt"] = promptStr.length > 0
        ? `${promptStr}\n\n${entry.body}`
        : entry.body;
    }
  }
}
