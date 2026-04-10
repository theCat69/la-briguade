import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Plugin } from "@opencode-ai/plugin";

import { resolveConfigBaseDirs, resolveUserConfig } from "./config/index.js";
import { registerAgents } from "./plugin/agents.js";
import { registerCommands } from "./plugin/commands.js";
import {
  collectSkillBashPermissions,
  collectSkillMcps,
  injectSkillBashPermissions,
  injectSkillMcpPermissions,
  mergeSkillMcps,
} from "./plugin/mcp.js";
import { registerSkills } from "./plugin/skills.js";
import { loadVendorPrompts } from "./plugin/vendors.js";
import { createHooks } from "./hooks/index.js";
import type { AgentSectionsEntry } from "./hooks/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contentDir = join(__dirname, "..", "content");
const builtinAgentsDir = join(contentDir, "agents");
const builtinCommandsDir = join(contentDir, "commands");
const builtinSkillsDir = join(contentDir, "skills");
const builtinVendorDir = join(contentDir, "vendor-prompts");

const LaBriguadePlugin: Plugin = async (ctx) => {
  // Shared mutable map populated in config() and read by the system transform hook.
  // Keyed by agent name (e.g. "coder", "reviewer") — not by base prompt text — so
  // agents with identical base prompts never collide. config() is called once before
  // any chat session begins, so the map is fully populated before the hook fires.
  const agentSections: Map<string, AgentSectionsEntry> = new Map();
  const { globalDir, projectDir } = resolveConfigBaseDirs(ctx.directory);
  const userAgentsDirs = [
    join(globalDir, "content", "agents"),
    join(projectDir, "content", "agents"),
  ];
  const userCommandsDirs = [
    join(globalDir, "content", "commands"),
    join(projectDir, "content", "commands"),
  ];
  const userSkillRoots = [
    join(globalDir, "content", "skills"),
    join(projectDir, "content", "skills"),
  ];
  const userVendorDirs = [
    join(globalDir, "content", "vendor-prompts"),
    join(projectDir, "content", "vendor-prompts"),
  ];
  const vendorPrompts = loadVendorPrompts([builtinVendorDir, ...userVendorDirs]);

  return {
    config: async (input) => {
      const userConfig = resolveUserConfig(ctx.directory);
      const { agentSections: sections } = registerAgents(
        input,
        [builtinAgentsDir, ...userAgentsDirs],
        userConfig,
      );
      for (const [key, value] of sections) {
        agentSections.set(key, value);
      }
      registerCommands(input, [builtinCommandsDir, ...userCommandsDirs]);
      const { dirs: skillDirs } = registerSkills(
        input,
        [builtinSkillsDir, ...userSkillRoots],
      );
      const { mcpMap, skillMcpIndex } = collectSkillMcps(skillDirs);
      mergeSkillMcps(input, mcpMap);
      injectSkillMcpPermissions(input, skillMcpIndex);
      const skillBashPermIndex = collectSkillBashPermissions(skillDirs);
      injectSkillBashPermissions(input, skillBashPermIndex);
    },
    ...createHooks(ctx, agentSections, vendorPrompts),
  };
};

export default LaBriguadePlugin;
