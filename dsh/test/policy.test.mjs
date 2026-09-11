import assert from "node:assert/strict";
import test from "node:test";

import { parseMarkdown } from "../lib/content.js";
import { childPolicy, validateDelegation } from "../lib/delegation.js";
import { isEditMismatch } from "../lib/hooks.js";
import { resolveMcpServers } from "../lib/mcp.js";

test("should keep specialist permissions independent from canonical frontmatter", () => {
  assert.deepEqual(childPolicy("security-reviewer"), { allow: ["read", "grep", "glob", "skill"] });
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
