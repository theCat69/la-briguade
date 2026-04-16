import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Plugin } from "@opencode-ai/plugin";

import {
  resolveConfigBaseDirs,
  resolveOpencodeConfigDir,
  resolveUserConfig,
} from "./config/index.js";
import { createHooks } from "./hooks/index.js";
import type { AgentSectionsEntry } from "./hooks/index.js";
import { registerAgents } from "./plugin/agents.js";
import { registerCommands } from "./plugin/commands.js";
import {
  collectSkillAgents,
  collectSkillBashPermissions,
  collectSkillMcps,
  injectSkillAgentPermissions,
  injectSkillBashPermissions,
  injectSkillMcpPermissions,
  mergeSkillMcps,
} from "./plugin/mcp/index.js";
import { registerSkills } from "./plugin/skills.js";
import {
  collectAutoInjectSkills,
  injectAutoInjectSkills,
  resolveActiveSkills,
} from "./plugin/auto-inject.js";
import { collectDirs } from "./utils/content-merge.js";
import { loadVendorPrompts } from "./plugin/vendors.js";
import { initLogger, logger } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contentDir = join(__dirname, "..", "content");
const builtinAgentsDir = join(contentDir, "agents");
const builtinCommandsDir = join(contentDir, "commands");
const builtinSkillsDir = join(contentDir, "skills");
const builtinAutoInjectRoot = join(contentDir, "auto-inject-skills");
const builtinVendorDir = join(contentDir, "vendor-prompts");

const LaBriguadePlugin: Plugin = async (ctx) => {
  initLogger();

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
    join(resolveOpencodeConfigDir(), "skills"),
    join(globalDir, "content", "skills"),
    join(projectDir, ".opencode", "skills"),
    join(projectDir, "la-briguade", "skills"),
    join(projectDir, "content", "skills"),
  ];
  const userAutoInjectRoots = [
    join(globalDir, "content", "auto-inject-skills"),
    join(projectDir, ".opencode", "auto-inject-skills"),
    join(projectDir, "la-briguade", "skills"),
    join(projectDir, "content", "auto-inject-skills"),
  ];
  const userVendorDirs = [
    join(globalDir, "content", "vendor-prompts"),
    join(projectDir, "content", "vendor-prompts"),
  ];
  const vendorPrompts = loadVendorPrompts([builtinVendorDir, ...userVendorDirs]);
  const agentSections = new Map<string, AgentSectionsEntry>();

  const hooks = createHooks(ctx, agentSections, vendorPrompts);

  return {
    config: async (input) => {
      const userConfig = resolveUserConfig(ctx.directory);
      logger.setLevel(userConfig.log_level ?? "warn");
      const { agentSections: sections } = registerAgents(
        input,
        [builtinAgentsDir, ...userAgentsDirs],
        userConfig,
      );
      registerCommands(input, [builtinCommandsDir, ...userCommandsDirs]);
      const { dirs: skillDirs } = registerSkills(
        input,
        [builtinSkillsDir, ...userSkillRoots],
      );
      const skillAgentIndex = collectSkillAgents(skillDirs);
      injectSkillAgentPermissions(input, skillAgentIndex);
      const { mcpMap, skillMcpIndex } = collectSkillMcps(skillDirs);
      mergeSkillMcps(input, mcpMap);
      injectSkillMcpPermissions(input, skillMcpIndex);
      const skillBashPermIndex = collectSkillBashPermissions(skillDirs);
      injectSkillBashPermissions(input, skillBashPermIndex);
      const autoInjectDirMap = collectDirs([builtinAutoInjectRoot, ...userAutoInjectRoots]);
      const autoInjectDirs = [...autoInjectDirMap.values()];
      const autoInjectEntries = collectAutoInjectSkills(autoInjectDirs);
      const activeSkills = resolveActiveSkills(autoInjectEntries, ctx.directory);
      injectAutoInjectSkills(input, autoInjectEntries, activeSkills);
      for (const [agentName, entry] of sections) {
        agentSections.set(agentName, entry);
      }
    },
    ...hooks,
  };
};

export default LaBriguadePlugin;
