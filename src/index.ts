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

const agentsDir = "agents";
const commandsDir = "commands";
const skillsDir = "skills";
const vendorPromptsDir = "vendor-prompts"
const autoInjectSkillsDir = "auto-inject-skills";
const laBriguadeUserDir = "la_briguade"
const laBriguadeProjectDir = "." + laBriguadeUserDir;
const opencodeUserDir = "opencode";
const opencodeProjectDir = "." + opencodeUserDir;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contentDir = join(__dirname, "..", "content");
const builtinAgentsDir = join(contentDir, agentsDir);
const builtinCommandsDir = join(contentDir, commandsDir);
const builtinSkillsDir = join(contentDir, skillsDir);
const builtinAutoInjectRoot = join(contentDir, autoInjectSkillsDir);
const builtinVendorDir = join(contentDir, vendorPromptsDir);


const LaBriguadePlugin: Plugin = async (ctx) => {
  initLogger();

  const { globalDir, projectDir } = resolveConfigBaseDirs(ctx.directory);
  // Agents: builtin < global (~/la_briguade/agents/) < project (<root>/la_briguade/agents/) — last-wins
  const userAgentsDirs = [
    join(globalDir, agentsDir),                   // global: ~/la_briguade/agents
    join(projectDir, laBriguadeProjectDir, agentsDir),   // project: <root>/la_briguade/agents
  ];
  // Commands: builtin < global (~/la_briguade/commands/) < project (<root>/la_briguade/commands/) — last-wins
  const userCommandsDirs = [
    join(globalDir, commandsDir),                 // global: ~/la_briguade/commands
    join(projectDir, laBriguadeProjectDir, commandsDir), // project: <root>/la_briguade/commands
  ];
  // Skills: opencode (~/.config/opencode/skills/) < global (~/la_briguade/skills/) < opencode project (<root>/.opencode/skills/) < project (<root>/la_briguade/skills/) — last-wins
  const userSkillRoots = [
    join(resolveOpencodeConfigDir(), skillsDir),   // opencode global: ~/.config/opencode/skills
    join(globalDir, skillsDir),                    // global: ~/la_briguade/skills
    join(projectDir, opencodeProjectDir, skillsDir),      // opencode project: <root>/.opencode/skills
    join(projectDir, laBriguadeProjectDir, skillsDir),    // project: <root>/la_briguade/skills
  ];
  // Auto-inject: builtin < global auto-inject < global skills < project skills — last-wins
  const userAutoInjectRoots = [
    join(globalDir, autoInjectSkillsDir),             // global: ~/la_briguade/auto-inject-skills
    join(globalDir, skillsDir),                         // global skills with agents: frontmatter
    join(projectDir, laBriguadeProjectDir, skillsDir),         // project: <root>/la_briguade/skills
  ];
  // Vendor prompts: builtin < global (~/la_briguade/vendor-prompts/) < project (<root>/la_briguade/vendor-prompts/) — last-wins
  const userVendorDirs = [
    join(globalDir, vendorPromptsDir),                 // global: ~/la_briguade/vendor-prompts
    join(projectDir, laBriguadeProjectDir, vendorPromptsDir), // project: <root>/la_briguade/vendor-prompts
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
