import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageDir = join(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(readFileSync(join(packageDir, "manifest.json"), "utf8"));

test("should generate the canonical primary personas", () => {
  for (const id of ["builder", "orchestrator", "planner", "ask"]) {
    assert.equal(manifest.agents.find((entry) => entry.id === id)?.intent, "primary");
    assert.equal(existsSync(join(packageDir, "agents", `${id}.md`)), true);
  }
});

test("should generate all canonical workflows as Codex skills", () => {
  assert.equal(manifest.workflows.length, 17);
  for (const workflow of manifest.workflows) {
    const content = readFileSync(join(packageDir, "skills", workflow.name, "SKILL.md"), "utf8");
    assert.match(content, new RegExp(`name: ${workflow.name}`));
    assert.match(content, /user-invocable: true/u);
  }
});

test("should preserve MCP provenance and Codex instructions", () => {
  assert.deepEqual(manifest.mcp, [
    { skill: "context7", key: "context7", transport: "stdio" },
    { skill: "drawio", key: "drawio", transport: "streamable-http" },
    { skill: "next-devtools", key: "next-devtools", transport: "stdio" },
    { skill: "serena", key: "serena", transport: "stdio" },
  ]);
  const instructions = readFileSync(join(packageDir, "AGENTS.md"), "utf8");
  assert.match(instructions, /Codex sandbox, approval, model, and network policies remain authoritative/u);
  assert.match(instructions, /does not provide edit old-string-mismatch recovery/u);
});
