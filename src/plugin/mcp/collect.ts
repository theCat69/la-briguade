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
};

type ReadSkillFileError =
  | { kind: "not-found" }
  | { kind: "read-error"; skillFilePath: string; error: unknown }
  | { kind: "invalid-frontmatter"; skillFilePath: string };

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
    },
  };
}

function warnReadSkillFileError(error: ReadSkillFileError): void {
  if (error.kind === "not-found") {
    return;
  }

  if (error.kind === "read-error") {
    logger.warn(`Could not read skill file: ${error.skillFilePath} (${String(error.error)})`);
    return;
  }

  logger.warn(`Invalid frontmatter in: ${error.skillFilePath}`);
}

export function collectSkillMcps(
  skillDirs: string[],
): { mcpMap: SkillMcpMap; skillMcpIndex: SkillMcpIndex } {
  const collected: SkillMcpMap = {};
  const skillMcpIndex: SkillMcpIndex = {};
  const seenBySkillDir = new Map<string, string>();

  for (const skillDir of skillDirs) {
    const fileDataResult = readSkillFileData(skillDir);
    if (!fileDataResult.ok) {
      warnReadSkillFileError(fileDataResult.error);
      continue;
    }

    const { attributes, skillName, skillFilePath } = fileDataResult.value;
    const mcpAttributes = attributes["mcp"];
    if (mcpAttributes === undefined) {
      continue;
    }

    const parsedMcpMap = SkillMcpMapSchema.safeParse(mcpAttributes);
    if (!parsedMcpMap.success) {
      logger.warn(`Invalid skill MCP frontmatter in: ${skillFilePath}`);
      continue;
    }

    for (const [key, entry] of Object.entries(parsedMcpMap.data)) {
      const firstSkillDir = seenBySkillDir.get(key);
      if (firstSkillDir !== undefined) {
        logger.warn(
          `skill MCP conflict: key "${key}" declared by both ` +
            `"${firstSkillDir}" and "${skillDir}" — "${firstSkillDir}" wins`,
        );
        continue;
      }

      seenBySkillDir.set(key, skillDir);
      collected[key] = toSdkMcpEntry(key, entry);

      const skillBindings = skillMcpIndex[skillName] ?? [];
      skillBindings.push({
        id: key,
        permission: buildPrefixedPermissionMap(key, entry.permission),
      });
      skillMcpIndex[skillName] = skillBindings;
    }
  }

  return { mcpMap: collected, skillMcpIndex };
}

export function collectSkillBashPermissions(skillDirs: string[]): SkillBashPermIndex {
  const skillBashPermIndex: SkillBashPermIndex = {};

  for (const skillDir of skillDirs) {
    const fileDataResult = readSkillFileData(skillDir);
    if (!fileDataResult.ok) {
      warnReadSkillFileError(fileDataResult.error);
      continue;
    }

    const { attributes, skillName, skillFilePath } = fileDataResult.value;
    const permissionAttributes = attributes["permission"];
    if (permissionAttributes === undefined) {
      continue;
    }

    const parsedPermission = SkillPermissionFrontmatterSchema.safeParse(permissionAttributes);
    if (!parsedPermission.success) {
      logger.warn(`Invalid skill permission frontmatter in: ${skillFilePath}`);
      continue;
    }

    const bashPerms = parsedPermission.data.bash;
    if (bashPerms !== undefined) {
      skillBashPermIndex[skillName] = bashPerms;
    }
  }

  return skillBashPermIndex;
}
