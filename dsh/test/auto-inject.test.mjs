import assert from "node:assert/strict";
import test from "node:test";

import { apply, createAutoInjectRuntime } from "../lib/auto-inject.js";

function createFs(files) {
  const targets = new Map([["/workspace", { targetKey: "/workspace", displayPath: "/workspace" }]]);
  let listCalls = 0;
  const target = (path) => {
    if (!targets.has(path)) targets.set(path, { targetKey: path, displayPath: path });
    return targets.get(path);
  };
  return {
    get listCalls() { return listCalls; },
    async resolve(path, options = {}) {
      const normalized = path.startsWith("/") ? path : `${options.cwd}/${path}`;
      return target(normalized);
    },
    async stat(entry) {
      if (entry.targetKey === "/workspace") return { type: "directory" };
      return files.has(entry.targetKey) ? { type: "file", size: Buffer.byteLength(files.get(entry.targetKey), "utf8") } : undefined;
    },
    contains(parent, child) { return child.targetKey === parent.targetKey || child.targetKey.startsWith(`${parent.targetKey}/`); },
    async listDir(entry) {
      listCalls += 1;
      if (entry.targetKey !== "/workspace") return [];
      return [...files.keys()].filter((path) => path.split("/").length === 3).map((path) => ({ name: path.slice("/workspace/".length), type: "file", target: target(path) }));
    },
    async readBytes(entry) { return new TextEncoder().encode(files.get(entry.targetKey)); },
  };
}

function install(runtime, fs) {
  const listeners = new Map();
  const ctx = {
    laBriguadeAutoInject: runtime,
    fs,
    agents: { get: () => undefined },
    on(name, listener) { listeners.set(name, listener); return () => {}; },
  };
  apply(ctx, { persona: "builder" });
  return listeners;
}

function assembly(agent) {
  return {
    sections: [
      { name: "deployment:persona-prefix", text: "persona" },
      { name: "tool:read", text: "tool guidance" },
    ],
    contexts: [],
    tools: [],
    variables: {},
    agent,
  };
}

test("should cache bounded workspace detection and inject deterministic eligible guidance", async () => {
  const runtime = createAutoInjectRuntime({ enabled: true, maxDepth: 0 });
  const fs = createFs(new Map([
    ["/workspace/tsconfig.json", "{}"],
    ["/workspace/package.json", JSON.stringify({ dependencies: { react: "19" } })],
  ]));
  const listeners = install(runtime, fs);
  const agent = { id: "session-1", session: { header: { id: "session-1", cwd: "/workspace", agentPreset: "builder" } } };
  const assemble = listeners.get("system-prompt/assemble");

  const first = await assemble(assembly(agent), { agent }, async () => assembly(agent));
  const second = await assemble(assembly(agent), { agent }, async () => assembly(agent));

  const block = first.sections.find((section) => section.name === "la-briguade:auto-injected-skills");
  assert.ok(block);
  assert.match(block.text, /<auto-injected-skills>/u);
  assert.match(block.text, /#general-coding/u);
  assert.match(block.text, /#typescript/u);
  assert.match(block.text, /#react/u);
  assert.equal(first.sections.filter((section) => section.name === "la-briguade:auto-injected-skills").length, 1);
  assert.equal(second.sections.find((section) => section.name === "la-briguade:auto-injected-skills").text, block.text);
  assert.equal(fs.listCalls, 1);
});

test("should share one cold detection across concurrent prompt assemblies", async () => {
  const runtime = createAutoInjectRuntime({ enabled: true, maxDepth: 0 });
  const fs = createFs(new Map([["/workspace/tsconfig.json", "{}"]]));
  const listeners = install(runtime, fs);
  const agent = { id: "session-1", session: { header: { id: "session-1", cwd: "/workspace", agentPreset: "builder" } } };
  const assemble = listeners.get("system-prompt/assemble");

  await Promise.all([
    assemble(assembly(agent), { agent }, async () => assembly(agent)),
    assemble(assembly(agent), { agent }, async () => assembly(agent)),
  ]);

  assert.equal(fs.listCalls, 1);
});

test("should refresh only after a successful relevant DSH filesystem write", async () => {
  const runtime = createAutoInjectRuntime({ enabled: true, maxDepth: 0 });
  const fs = createFs(new Map([["/workspace/tsconfig.json", "{}"]]));
  const listeners = install(runtime, fs);
  const agent = { id: "session-1", session: { header: { id: "session-1", cwd: "/workspace", agentPreset: "builder" } } };
  const assemble = listeners.get("system-prompt/assemble");
  const post = listeners.get("tools/post-execute");

  await assemble(assembly(agent), { agent }, async () => assembly(agent));
  await post({ name: "write", arguments: { file_path: "/workspace/README.md" }, agent, signal: undefined }, { isError: false }, async () => ({ kind: "accept" }));
  await assemble(assembly(agent), { agent }, async () => assembly(agent));
  assert.equal(fs.listCalls, 1);

  await post({ name: "write", arguments: { file_path: "/workspace/tsconfig.json" }, agent, signal: undefined }, { isError: false }, async () => ({ kind: "accept" }));
  await assemble(assembly(agent), { agent }, async () => assembly(agent));
  assert.equal(fs.listCalls, 2);
});

test("should omit all detection and prompt content when disabled", async () => {
  const runtime = createAutoInjectRuntime({ enabled: false, maxDepth: 0 });
  const fs = createFs(new Map([["/workspace/tsconfig.json", "{}"]]));
  const listeners = install(runtime, fs);
  const agent = { id: "session-1", session: { header: { id: "session-1", cwd: "/workspace", agentPreset: "builder" } } };
  const result = await listeners.get("system-prompt/assemble")(assembly(agent), { agent }, async () => assembly(agent));

  assert.equal(result.sections.some((section) => section.name === "la-briguade:auto-injected-skills"), false);
  assert.equal(fs.listCalls, 0);
});
