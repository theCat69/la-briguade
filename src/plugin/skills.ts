import type { Config } from "../types/plugin.js";
import { collectDirs } from "../utils/content-merge.js";
import { isRecord } from "../utils/type-guards.js";

/**
 * Register the plugin's bundled skills directory into the config.
 *
 * Opencode discovers skills from directories containing `SKILL.md` files.
 * The `config.skills.paths` array lets plugins register additional skill
 * root directories — opencode will scan `<path>/\*\/SKILL.md` patterns.
 *
 * Only registers the path if the directory exists and contains at least
 * one skill subdirectory.
 */
export function registerSkills(config: Config, skillRoots: string[]): { dirs: string[] } {
  const mergedSkillDirs = collectDirs(skillRoots);
  const validSkillDirs = [...mergedSkillDirs.values()];

  if (validSkillDirs.length === 0) return { dirs: [] };

  if (!isRecord(config)) return { dirs: validSkillDirs };

  const configRecord: Record<string, unknown> = config;
  const rawSkills = configRecord["skills"];
  const skillsRecord = isRecord(rawSkills) ? rawSkills : {};
  const existingPaths = Array.isArray(skillsRecord["paths"])
    ? skillsRecord["paths"].filter((value): value is string => typeof value === "string")
    : [];

  configRecord["skills"] = {
    ...skillsRecord,
    paths: [...existingPaths, ...validSkillDirs],
  };

  return { dirs: validSkillDirs };
}
