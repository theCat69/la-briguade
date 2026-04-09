import type { Plugin } from "@opencode-ai/plugin";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { resolveUserConfig } from "./config/index.js";
import { registerAgents } from "./plugin/agents.js";
import { registerSkills } from "./plugin/skills.js";
import { registerCommands } from "./plugin/commands.js";
import { createHooks } from "./hooks/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contentDir = join(__dirname, "..", "content");

const LaBriguadePlugin: Plugin = async (ctx) => {
  return {
    config: async (input) => {
      const userConfig = resolveUserConfig(ctx.directory);
      registerAgents(input, contentDir, userConfig);
      registerCommands(input, contentDir);
      registerSkills(input, contentDir);
    },
    ...createHooks(ctx),
  };
};

export default LaBriguadePlugin;
