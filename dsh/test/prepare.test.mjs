import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(packageDir, "content", "manifest.json"), "utf8"));
const workflows = [
  "init-implementer", "update-implementer", "interview", "critic", "full-review", "go-back-to-work",
  "unslop", "unslop-loop", "refactor", "local-context-full-gathering", "to-spec", "to-tickets",
  "implement", "just-do-it", "grilling", "handoff", "learn",
];
const specialists = [
  "coder", "architect", "critic", "feature-designer", "feature-reviewer", "security-reviewer",
  "local-context-gatherer", "external-context-gatherer", "sidekick-reviewer", "sidekick-security-reviewer", "sidekick-librarian",
];

for (const name of ["builder", "orchestrator", "planner", "ask"]) {
  test(`should generate the ${name} DSH persona from canonical agent content`, () => {
    const presetPath = join(packageDir, "presets", name, "preset.yml");
    const compositionPath = join(packageDir, "presets", name, "agent.cordis.yml");
    assert.equal(existsSync(presetPath), true);
    assert.match(readFileSync(presetPath, "utf8"), new RegExp(`name: ${name}`));
    assert.match(readFileSync(compositionPath, "utf8"), /name: '@deepseek-ai\/dsh-persona'/u);
  });
}

test("should generate all canonical workflows as user-invocable DSH skills", () => {
  assert.equal(manifest.workflows.length, 17);
  for (const id of workflows) {
    const path = join(packageDir, "content", "workflows", id, "SKILL.md");
    const workflow = readFileSync(path, "utf8");
    assert.match(workflow, new RegExp(`name: la-briguade-${id}`));
    assert.match(workflow, /user-invocable: true/u);
  }
});

test("should preserve provenance and all specialist prompts in the generated manifest", () => {
  for (const id of specialists) {
    const agent = manifest.agents.find((entry) => entry.id === id);
    assert.ok(agent, `missing specialist ${id}`);
    assert.equal(agent.intent, "specialist");
    assert.equal(existsSync(join(packageDir, "content", "personas", `${id}.md`)), true);
  }
  assert.equal(existsSync(join(packageDir, "content", "skills", "git-commit", "SKILL.md")), true);
});
