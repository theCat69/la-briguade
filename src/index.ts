import type { Plugin } from "@opencode-ai/plugin";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
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
      registerAgents(input, contentDir);
      registerCommands(input, contentDir);
      registerSkills(input, contentDir);
    },
    ...createHooks(ctx),
  };
};

export default LaBriguadePlugin;
