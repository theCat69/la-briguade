import type { Config } from "../../types/plugin.js";
import { isRecord } from "../../utils/type-guards.js";

import type { SkillBashPermIndex, SkillMcpIndex } from "./types.js";

function buildPrefixedPermissionMap(
  id: string,
  permissionBlock: Record<string, string> | undefined,
): Record<string, string> {
  if (permissionBlock === undefined) {
    return { [`${id}_*`]: "allow" };
  }

  const prefixedPermissions: Record<string, string> = {};
  for (const [toolName, value] of Object.entries(permissionBlock)) {
    prefixedPermissions[`${id}_${toolName}`] = value;
  }
  return prefixedPermissions;
}

export function injectSkillBashPermissions(
  input: Config,
  skillBashPermIndex: SkillBashPermIndex,
): void {
  if (!isRecord(input.agent)) {
    return;
  }

  for (const agentConfig of Object.values(input.agent)) {
    if (!isRecord(agentConfig)) {
      continue;
    }
    const agentRecord: Record<string, unknown> = agentConfig;

    const rawPermission = agentRecord["permission"];
    if (!isRecord(rawPermission)) {
      continue;
    }

    const rawSkillPerms = rawPermission["skill"];
    if (!isRecord(rawSkillPerms)) {
      continue;
    }

    for (const [skillName, bashPerms] of Object.entries(skillBashPermIndex)) {
      const directPermission = rawSkillPerms[skillName];
      if (directPermission === "deny") {
        continue;
      }

      let resolvedSkillPermission: unknown;
      if (directPermission === "allow" || directPermission === "ask") {
        resolvedSkillPermission = directPermission;
      } else {
        resolvedSkillPermission = rawSkillPerms["*"];
      }

      if (resolvedSkillPermission !== "allow" && resolvedSkillPermission !== "ask") {
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
  }
}

export function injectSkillMcpPermissions(input: Config, skillMcpIndex: SkillMcpIndex): void {
  if (!isRecord(input.agent)) {
    return;
  }

  for (const agentConfig of Object.values(input.agent)) {
    if (!isRecord(agentConfig)) {
      continue;
    }
    const agentRecord: Record<string, unknown> = agentConfig;

    const rawPermission = agentRecord["permission"];
    if (!isRecord(rawPermission)) {
      continue;
    }

    const rawSkillPerms = rawPermission["skill"];
    if (!isRecord(rawSkillPerms)) {
      continue;
    }

    for (const [skillName, bindings] of Object.entries(skillMcpIndex)) {
      const directPermission = rawSkillPerms[skillName];
      if (directPermission === "deny") {
        continue;
      }

      let resolvedSkillPermission: unknown;
      if (directPermission === "allow" || directPermission === "ask") {
        resolvedSkillPermission = directPermission;
      } else {
        resolvedSkillPermission = rawSkillPerms["*"];
      }

      if (resolvedSkillPermission !== "allow" && resolvedSkillPermission !== "ask") {
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
  }
}
