import assert from "node:assert/strict";
import test from "node:test";

import { apply } from "../index.js";

test("should return only declared properties from every la-briguade tool", async () => {
  const registered = new Map();
  const parent = { id: "agent-1", session: { id: "session-1" } };
  const ctx = {
    provide: () => () => {},
    agents: { currentInitiator: () => parent },
    skills: { register: () => () => {} },
    tools: { register: (tool) => { registered.set(tool.name, tool); return () => {}; } },
    subagents: {
      start: async () => ({
        result: Promise.resolve({ output: [{ type: "text", text: "done" }], stopReason: "completed" }),
        dispose: async () => {},
      }),
      startContinuable: async () => ({ childId: "child-1" }),
      sendMessage: async () => {},
      interrupt: () => {},
      drainContinuableChildren: async () => {},
    },
  };

  await apply(ctx);

  const outputs = new Map([
    ["la_briguade_personas", await registered.get("la_briguade_personas").execute({}, {})],
    ["la_briguade_delegate", await registered.get("la_briguade_delegate").execute({ persona: "coder", task: "check", mode: "spawn" }, { signal: undefined })],
    ["la_briguade_sidekick", await registered.get("la_briguade_sidekick").execute({ mode: "CODE_REVIEW", task: "check", new_session: false }, { signal: undefined })],
    ["la_briguade_status", await registered.get("la_briguade_status").execute({}, {})],
  ]);

  for (const [name, value] of outputs) {
    const tool = registered.get(name);
    const declared = Object.keys(tool.output.schema.properties).sort();
    assert.deepEqual(Object.keys(value).sort(), declared, `${name} output keys must match its strict schema`);
  }
});
