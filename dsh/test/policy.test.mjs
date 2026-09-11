import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { parseMarkdown } from "../lib/content.js";
import { childPolicy, childToolInstruction, validateDelegation } from "../lib/delegation.js";
import { isEditMismatch } from "../lib/hooks.js";
import { resolveMcpServers } from "../lib/mcp.js";
import { collectBundledSkillMcps, mergeSkillMcps } from "../lib/skill-mcp.js";

test("should keep specialist tool boundaries independent from canonical frontmatter", () => {
  assert.deepEqual(childPolicy("security-reviewer"), { allow: ["read", "grep", "glob", "skill"] });
  assert.match(childToolInstruction("local-context-gatherer"), /only these tools when they are available: read, grep, glob, skill/u);
  assert.match(childToolInstruction("local-context-gatherer"), /Do not use other tools/u);
  assert.throws(() => validateDelegation({ persona: "unknown", task: "x" }, ["coder"]));
  assert.deepEqual(validateDelegation({ persona: "coder", task: " implement ", mode: "spawn" }, ["coder"]), { persona: "coder", task: "implement", mode: "spawn" });
});

test("should reject unsafe or unavailable MCP command values without exposing secrets", () => {
  const diagnostics = [];
  const result = resolveMcpServers({ example: { transport: "stdio", serverName: "example", command: "node", args: ["{env: TOKEN}"], env: {}, cwd: process.cwd() } }, { TOKEN: "bad;value" }, diagnostics);
  assert.deepEqual(result, []);
  assert.equal(diagnostics.some((entry) => entry.message.includes("unsafe")), true);
  assert.equal(JSON.stringify(diagnostics).includes("bad;value"), false);
});

test("should discover Context7 from bundled skill MCP frontmatter and preserve explicit overrides", () => {
  const diagnostics = [];
  const result = collectBundledSkillMcps(join(process.cwd(), "content", "skills"), diagnostics);
  assert.deepEqual(result.servers.context7, {
    transport: "stdio",
    serverName: "context7",
    command: "npx",
    args: ["--prefer-offline", "@upstash/context7-mcp@2.1.7"],
    env: { CONTEXT7_API_KEY: "{env:CONTEXT7_API_KEY}" },
    toolCallTimeoutMs: 30_000,
    failOnStartupError: false,
  });
  assert.deepEqual(result.provenance, [
    { skill: "context7", key: "context7", transport: "stdio" },
    { skill: "next-devtools", key: "next-devtools", transport: "stdio" },
  ]);
  assert.deepEqual(mergeSkillMcps(result.servers, { context7: { transport: "stdio", serverName: "context7", command: "custom", args: [], env: {}, cwd: process.cwd() } }).context7.command, "custom");
  assert.deepEqual(diagnostics, []);
});

test("should preserve explicit MCP servers before enforcing the total limit", () => {
  const explicit = Object.fromEntries(Array.from({ length: 10 }, (_value, index) => [`explicit-${index}`, { transport: "stdio" }]));
  const diagnostics = [];
  const merged = mergeSkillMcps({ context7: { transport: "stdio" } }, explicit, diagnostics);
  assert.equal(Object.keys(merged).length, 10);
  assert.equal(merged.context7, undefined);
  assert.equal(diagnostics.some((entry) => entry.message.includes("total MCP server limit")), true);
});

test("should skip disabled and unsafe bundled skill MCP declarations", () => {
  const root = mkdtempSync(join(tmpdir(), "la-briguade-dsh-mcp-"));
  try {
    mkdirSync(join(root, "disabled"));
    mkdirSync(join(root, "unsafe"));
    writeFileSync(join(root, "disabled", "SKILL.md"), "---\nmcp:\n  disabled:\n    type: local\n    enabled: false\n    command: [node]\n---\n");
    writeFileSync(join(root, "unsafe", "SKILL.md"), "---\nmcp:\n  unsafe:\n    type: local\n    command: [node, '; rm -rf /']\n---\n");
    const diagnostics = [];
    assert.deepEqual(collectBundledSkillMcps(root, diagnostics).servers, {});
    assert.equal(JSON.stringify(diagnostics).includes("; rm -rf /"), false);
    assert.equal(diagnostics.some((entry) => entry.message.includes("invalid")), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("should preserve edit failures except for recognized edit mismatch feedback", () => {
  assert.equal(isEditMismatch("edit", { isError: true, content: [{ type: "text", text: "oldString not found" }] }), true);
  assert.equal(isEditMismatch("read", { isError: true, content: [{ type: "text", text: "oldString not found" }] }), false);
});

test("should parse only bounded non-authoritative content metadata", () => {
  const diagnostics = [];
  const parsed = parseMarkdown("---\ndescription: safe\npermission: allow\n---\nbody", "fixture.md", diagnostics);
  assert.equal(parsed.attributes.permission, "allow");
  assert.equal(parsed.body, "body");
  assert.equal(diagnostics.length, 0);
});
