import type { Config } from "../../types/plugin.js";
import { isRecord } from "../../utils/type-guards.js";

import {
  buildPrefixedPermissionMap,
  type SkillBashPermIndex,
  type SkillMcpIndex,
} from "./types.js";

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
  input: Config,
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
  input: Config,
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

export function injectSkillMcpPermissions(input: Config, skillMcpIndex: SkillMcpIndex): void {
  forEachAgentWithSkillPermission(input, (rawPermission, rawSkillPerms) => {
    for (const [skillName, bindings] of Object.entries(skillMcpIndex)) {
      if (resolveSkillPermission(rawSkillPerms, skillName) === undefined) {
        continue;
      }

      for (const binding of bindings) {
        const bindingPermissions =
          Object.keys(binding.permission).length > 0
            ? binding.permission
            : buildPrefixedPermissionMap(binding.id, undefined);

        for (const [permissionKey, permissionValue] of Object.entries(bindingPermissions)) {
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
