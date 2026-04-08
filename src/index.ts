import type { Plugin } from "@opencode-ai/plugin";
import { registerAgents } from "./plugin/agents.js";
import { registerSkills } from "./plugin/skills.js";
import { registerCommands } from "./plugin/commands.js";
import { createHooks } from "./hooks/index.js";

const LaBriguadePlugin: Plugin = async (ctx) => {
  const contentDir = new URL("../content", import.meta.url).pathname;

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
