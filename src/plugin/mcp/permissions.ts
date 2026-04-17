import type { Config } from "../../types/plugin.js";
import { logger } from "../../utils/runtime/logger.js";
import { isRecord } from "../../utils/support/type-guards.js";

import {
  type SkillAgentIndex,
  type SkillBashPermIndex,
  type SkillMcpIndex,
} from "./types.js";

export type AgentConfig = Pick<Config, "agent">;

function resolveSkillPermission(
  rawSkillPerms: Record<string, unknown>,
  skillName: string,
): "allow" | "ask" | undefined {
  const directPermission = rawSkillPerms[skillName];
  if (directPermission === "deny") {
    return undefined;
  }

  if (directPermission === "allow" || directPermission === "ask") {
    return directPermission;
  }

  const wildcardPermission = rawSkillPerms["*"];
  if (wildcardPermission === "allow" || wildcardPermission === "ask") {
    return wildcardPermission;
  }

  return undefined;
}

function forEachAgentWithSkillPermission(
  input: AgentConfig,
  callback: (
    rawPermission: Record<string, unknown>,
    rawSkillPerms: Record<string, unknown>,
  ) => void,
): void {
  if (!isRecord(input.agent)) {
    return;
  }

  for (const agentConfig of Object.values(input.agent)) {
    if (!isRecord(agentConfig)) {
      continue;
    }

    // Annotate as unknown so isRecord() narrows to Record<string, unknown> without
    // carrying the SDK's AgentPermissions intersection, which blocks "skill" key access.
    const rawPermission: unknown = agentConfig["permission"];
    if (!isRecord(rawPermission)) {
      continue;
    }

    const rawSkillPerms = rawPermission["skill"];
    if (!isRecord(rawSkillPerms)) {
      continue;
    }

    callback(rawPermission, rawSkillPerms);
  }
}

export function injectSkillBashPermissions(
  input: AgentConfig,
  skillBashPermIndex: SkillBashPermIndex,
): void {
  forEachAgentWithSkillPermission(input, (rawPermission, rawSkillPerms) => {
    for (const [skillName, bashPerms] of Object.entries(skillBashPermIndex)) {
      if (resolveSkillPermission(rawSkillPerms, skillName) === undefined) {
        continue;
      }

      const existingBash = rawPermission["bash"];
      if (existingBash !== undefined && existingBash !== null && !isRecord(existingBash)) {
        continue;
      }

      let bashSection: Record<string, unknown> | undefined = isRecord(existingBash)
        ? existingBash
        : undefined;

      for (const [pattern, value] of Object.entries(bashPerms)) {
        if (value === "deny") {
          continue;
        }
        if (bashSection === undefined) {
          bashSection = {};
          rawPermission["bash"] = bashSection;
        }
        if (bashSection[pattern] === undefined) {
          bashSection[pattern] = value;
        }
      }
    }
  });
}

export function injectSkillMcpPermissions(
  input: AgentConfig,
  skillMcpIndex: SkillMcpIndex,
): void {
  forEachAgentWithSkillPermission(input, (rawPermission, rawSkillPerms) => {
    for (const [skillName, bindings] of Object.entries(skillMcpIndex)) {
      if (resolveSkillPermission(rawSkillPerms, skillName) === undefined) {
        continue;
      }

      for (const binding of bindings) {
        for (const [permissionKey, permissionValue] of Object.entries(binding.permission)) {
          if (permissionValue === "deny") {
            continue;
          }
          if (rawPermission[permissionKey] === undefined) {
            rawPermission[permissionKey] = permissionValue;
          }
        }
      }
    }
  });
}

export function injectSkillAgentPermissions(
  input: AgentConfig,
  skillAgentIndex: SkillAgentIndex,
): void {
  if (!isRecord(input.agent)) {
    return;
  }

  for (const [skillName, agentNames] of Object.entries(skillAgentIndex)) {
    for (const agentName of agentNames) {
      const agentConfig = input.agent[agentName];
      if (!isRecord(agentConfig)) {
        logger.warn(
          `Could not inject skill permission: unknown agent "${agentName}" for skill "${skillName}"`,
        );
        continue;
      }

      const existingPermission = agentConfig["permission"];
      if (existingPermission !== undefined && existingPermission !== null && !isRecord(existingPermission)) {
        logger.warn(
          `Unexpected permission type for agent "${agentName}"; ` +
            "skipping skill injection",
        );
        continue;
      }

      let permissionSection: Record<string, unknown> | undefined = isRecord(existingPermission)
        ? existingPermission
        : undefined;
      if (permissionSection === undefined) {
        permissionSection = {};
        agentConfig["permission"] = permissionSection;
      }

      const existingSkill = permissionSection["skill"];
      if (existingSkill !== undefined && existingSkill !== null && !isRecord(existingSkill)) {
        logger.warn(
          `Unexpected permission type for agent "${agentName}"; ` +
            "skipping skill injection",
        );
        continue;
      }

      let skillSection: Record<string, unknown> | undefined = isRecord(existingSkill)
        ? existingSkill
        : undefined;
      if (skillSection === undefined) {
        skillSection = {};
        permissionSection["skill"] = skillSection;
      }

      if (skillSection[skillName] === undefined) {
        skillSection[skillName] = "allow";
      }
    }
  }
}
