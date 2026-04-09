<!-- Pattern: plugin-registration — How the Plugin function wires config callbacks and hooks into opencode -->

```typescript
// src/index.ts — The default export must be typed as Plugin from @opencode-ai/plugin.
// The plugin is an async function that returns { config, ...hooks }.
// config() receives the mutable input object — mutate it to register agents/skills/commands.
// createHooks(ctx) returns a Partial<HooksResult> to be spread in.
// Never mutate globals — only mutate the input object passed to config().

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
```
