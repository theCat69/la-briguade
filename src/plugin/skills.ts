import { statSync } from "node:fs";
import { resolve } from "node:path";
import type { Config } from "../types/plugin.js";
import { readDirSafe } from "../utils/read-dir.js";

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
export function registerSkills(config: Config, contentDir: string): void {
  const skillsDir = resolve(contentDir, "skills");

  const entries = readDirSafe(skillsDir, "skills");
  if (entries === undefined) return;

  // Verify at least one skill subdirectory exists
  const hasSkillDirs = entries.some((entry) => {
    try {
      return statSync(resolve(skillsDir, entry)).isDirectory();
    } catch {
      return false;
    }
  });

  if (!hasSkillDirs) return;

  const extended = config as ConfigWithSkills;
  extended.skills = {
    ...extended.skills,
    paths: [...(extended.skills?.paths ?? []), skillsDir],
  };
}
