import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import { parseFrontmatter } from "../../utils/frontmatter.js";
import { isNodeError, type Result } from "../../utils/type-guards.js";
import { logger } from "../../utils/logger.js";

import { toSdkMcpEntry } from "./merge.js";
import {
  SkillMcpMapSchema,
  SkillPermissionFrontmatterSchema,
  buildPrefixedPermissionMap,
  type SkillBashPermIndex,
  type SkillMcpIndex,
  type SkillMcpMap,
} from "./types.js";

const SKILL_FILE_NAME = "SKILL.md";

type SkillFileData = {
  attributes: Record<string, unknown>;
  skillName: string;
  skillFilePath: string;
  skillDir: string;
};

type ReadSkillFileError =
  | { kind: "not-found" }
  | { kind: "read-error"; skillFilePath: string; error: unknown };

function readSkillFileData(skillDir: string): Result<SkillFileData, ReadSkillFileError> {
  const skillFilePath = resolve(skillDir, SKILL_FILE_NAME);
  let rawSkillContent: string;

  try {
    rawSkillContent = readFileSync(skillFilePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { ok: false, error: { kind: "not-found" } };
    }
    return {
      ok: false,
      error: {
        kind: "read-error",
        skillFilePath,
        error,
      },
    };
  }

  const parsed = parseFrontmatter(rawSkillContent);
  return {
    ok: true,
    value: {
      attributes: parsed.attributes,
      skillName: basename(skillDir),
      skillFilePath,
      skillDir,
    },
  };
}

function forEachSkillDir(
  skillDirs: string[],
  callback: (fileData: SkillFileData) => void,
): void {
  for (const skillDir of skillDirs) {
    const fileDataResult = readSkillFileData(skillDir);
    if (!fileDataResult.ok) {
      if (fileDataResult.error.kind === "read-error") {
        logger.warn(
          `Could not read skill file: ${fileDataResult.error.skillFilePath} ` +
            `(${String(fileDataResult.error.error)})`,
        );
      }
      continue;
    }

    callback(fileDataResult.value);
  }
}

export function collectSkillMcps(
  skillDirs: string[],
): { mcpMap: SkillMcpMap; skillMcpIndex: SkillMcpIndex } {
  const collected: SkillMcpMap = {};
  const skillMcpIndex: SkillMcpIndex = {};
  const mcpKeyOwner = new Map<string, string>();

  forEachSkillDir(skillDirs, ({ attributes, skillName, skillFilePath, skillDir }) => {
    const mcpAttributes = attributes["mcp"];
    if (mcpAttributes === undefined) {
      return;
    }

    const parsedMcpMap = SkillMcpMapSchema.safeParse(mcpAttributes);
    if (!parsedMcpMap.success) {
      logger.warn(`Invalid skill MCP frontmatter in: ${skillFilePath}`);
      return;
    }

    for (const [key, entry] of Object.entries(parsedMcpMap.data)) {
      const firstSkillDir = mcpKeyOwner.get(key);
      if (firstSkillDir !== undefined) {
        logger.warn(
          `skill MCP conflict: key "${key}" declared by both ` +
            `"${firstSkillDir}" and "${skillDir}" — "${firstSkillDir}" wins`,
        );
        continue;
      }

      mcpKeyOwner.set(key, skillDir);
      collected[key] = toSdkMcpEntry(key, entry);

      const skillBindings = skillMcpIndex[skillName] ?? [];
      skillBindings.push({
        id: key,
        permission: buildPrefixedPermissionMap(key, entry.permission),
      });
      skillMcpIndex[skillName] = skillBindings;
    }
  });

  return { mcpMap: collected, skillMcpIndex };
}

export function collectSkillBashPermissions(skillDirs: string[]): SkillBashPermIndex {
  const skillBashPermIndex: SkillBashPermIndex = {};

  forEachSkillDir(skillDirs, ({ attributes, skillName, skillFilePath }) => {
    const permissionAttributes = attributes["permission"];
    if (permissionAttributes === undefined) {
      return;
    }

    const parsedPermission = SkillPermissionFrontmatterSchema.safeParse(permissionAttributes);
    if (!parsedPermission.success) {
      logger.warn(`Invalid skill permission frontmatter in: ${skillFilePath}`);
      return;
    }

    const bashPerms = parsedPermission.data.bash;
    if (bashPerms !== undefined) {
      skillBashPermIndex[skillName] = bashPerms;
    }
  });

  return skillBashPermIndex;
}
