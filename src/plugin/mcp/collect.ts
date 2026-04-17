import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { z } from "zod";

import { isSafePermissionSubKey } from "../../config/schema.js";
import { parseFrontmatter } from "../../utils/content/frontmatter.js";
import { logger } from "../../utils/runtime/logger.js";
import { isNodeError } from "../../utils/support/type-guards.js";

import { toSdkMcpEntry } from "./merge.js";
import {
  SkillMcpMapSchema,
  SkillPermissionFrontmatterSchema,
  buildPrefixedPermissionMap,
  type SkillAgentIndex,
  type SkillBashPermIndex,
  type SkillMcpIndex,
  type SkillMcpMap,
} from "./types.js";

const SKILL_FILE_NAME = "SKILL.md";

type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

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
    const skillName = basename(skillDir);
    if (!isSafePermissionSubKey(skillName)) {
      logger.warn(
        `Skill directory name "${skillName}" is unsafe; skipping`,
      );
      continue;
    }

    const fileDataResult = readSkillFileData(skillDir);
    if (!fileDataResult.ok) {
      if (fileDataResult.error.kind === "read-error") {
        logger.warn(
          `Could not read skill file: ${fileDataResult.error.skillFilePath} ` +
            `(${fileDataResult.error.error instanceof Error
              ? fileDataResult.error.error.message
              : String(fileDataResult.error.error)})`,
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

export function collectSkillAgents(skillDirs: string[]): SkillAgentIndex {
  const skillAgentIndex: SkillAgentIndex = {};
  const agentsSchema = z.array(z.string()).optional();

  forEachSkillDir(skillDirs, ({ attributes, skillName, skillFilePath }) => {
    const agentsAttributes = attributes["agents"];
    if (agentsAttributes === undefined) {
      return;
    }

    const parsedAgents = agentsSchema.safeParse(agentsAttributes);
    if (!parsedAgents.success) {
      logger.warn(`Invalid skill agents frontmatter in: ${skillFilePath}`);
      return;
    }

    const rawAgents = parsedAgents.data;
    if (rawAgents === undefined) {
      return;
    }

    const safeAgents = rawAgents.filter((agentName: string) => {
      if (!isSafePermissionSubKey(agentName)) {
        logger.warn(
          `Invalid skill agent name "${agentName}" in: ${skillFilePath}; ` +
            "skipping entry",
        );
        return false;
      }

      // Reject control characters (log injection guard)
      if (/[\x00-\x1f\x7f]/.test(agentName)) {
        logger.warn(
          `[la-briguade] Skill agent name "${agentName}" contains control characters; skipping`,
        );
        return false;
      }

      return true;
    });

    if (safeAgents.length > 0) {
      skillAgentIndex[skillName] = safeAgents;
    }
  });

  return skillAgentIndex;
}
