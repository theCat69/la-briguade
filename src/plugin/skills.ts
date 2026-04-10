import type { Config } from "../types/plugin.js";
import { collectDirs } from "../utils/content-merge.js";

/**
 * Extended config shape that includes the `skills` field available in the
 * opencode v2 runtime but not yet typed in the v1 SDK's Config definition.
 *
 * Cast required because @opencode-ai/sdk ^1.4.0 does not expose the
 * `skills` property on Config — the runtime accepts it, but the type
 * lags behind. Remove this cast once the SDK ships the updated type.
 */
interface ConfigWithSkills extends Config {
  skills?: {
    paths?: string[];
    urls?: string[];
  };
}

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

  const extended = config as ConfigWithSkills;
  extended.skills = {
    ...extended.skills,
    paths: [...(extended.skills?.paths ?? []), ...validSkillDirs],
  };

  return { dirs: validSkillDirs };
}
