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
  // Agents: builtin < old global < new global < old project < new project (last-wins)
  const userAgentsDirs = [
    join(globalDir, "agents"),                   // canonical: ~/la_briguade/agents
    join(projectDir, "la_briguade", "agents"),   // canonical: <root>/la_briguade/agents
  ];
  // Commands: same layering as agents
  const userCommandsDirs = [
    join(globalDir, "commands"),                 // canonical: ~/la_briguade/commands
    join(projectDir, "la_briguade", "commands"), // canonical: <root>/la_briguade/commands
  ];
  // Skills: opencode layout < old global < new global < opencode project < old project < new project
  const userSkillRoots = [
    join(resolveOpencodeConfigDir(), "skills"),   // opencode: ~/.config/opencode/skills
    join(globalDir, "skills"),                    // canonical: ~/la_briguade/skills
    join(projectDir, ".opencode", "skills"),      // opencode: <root>/.opencode/skills
    join(projectDir, "la_briguade", "skills"),    // canonical: <root>/la_briguade/skills
  ];
  // Auto-inject: mirrors skill roots plus dedicated auto-inject-skills dirs
  const userAutoInjectRoots = [
    join(globalDir, "auto-inject-skills"),             // canonical: ~/la_briguade/auto-inject-skills
    join(globalDir, "skills"),                         // global skills with agents: frontmatter
    join(projectDir, "content", "auto-inject-skills"), // legacy: <root>/content/auto-inject-skills
    join(projectDir, "la_briguade", "skills"),         // canonical: <root>/la_briguade/skills
  ];
  // Vendor prompts: same layering as agents
  const userVendorDirs = [
    join(globalDir, "vendor-prompts"),                 // canonical: ~/la_briguade/vendor-prompts
    join(projectDir, "la_briguade", "vendor-prompts"), // canonical: <root>/la_briguade/vendor-prompts
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
