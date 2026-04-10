import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Plugin } from "@opencode-ai/plugin";

import { resolveUserConfig } from "./config/index.js";
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

const LaBriguadePlugin: Plugin = async (ctx) => {
  // Shared mutable map populated in config() and read by the system transform hook.
  // Keyed by agent name (e.g. "coder", "reviewer") — not by base prompt text — so
  // agents with identical base prompts never collide. config() is called once before
  // any chat session begins, so the map is fully populated before the hook fires.
  const agentSections: Map<string, AgentSectionsEntry> = new Map();
  const vendorPrompts = loadVendorPrompts(contentDir);

  return {
    config: async (input) => {
      const userConfig = resolveUserConfig(ctx.directory);
      const { agentSections: sections } = registerAgents(input, contentDir, userConfig);
      for (const [key, value] of sections) {
        agentSections.set(key, value);
      }
      registerCommands(input, contentDir);
      const { dirs: skillDirs } = registerSkills(input, contentDir);
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
