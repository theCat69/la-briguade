import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));

for (const name of ["builder", "orchestrator", "planner", "ask"]) {
  test(`should generate the ${name} DSH persona from canonical agent content`, () => {
    // Arrange
    const presetPath = join(packageDir, "presets", name, "preset.yml");
    const compositionPath = join(packageDir, "presets", name, "agent.cordis.yml");

    // Act
    const preset = readFileSync(presetPath, "utf8");
    const composition = readFileSync(compositionPath, "utf8");

    // Assert
    assert.match(preset, new RegExp(`name: ${name}`));
    assert.match(composition, /name: '@deepseek-ai\/dsh-persona'/u);
    assert.match(composition, /prefix: \|-/u);
  });
}

test("should generate DSH-discoverable skills and the user-invocable workflow", () => {
  // Arrange
  const skillPath = join(packageDir, "content", "skills", "git-commit", "SKILL.md");
  const workflowPath = join(packageDir, "content", "workflows", "just-do-it", "SKILL.md");

  // Act
  const skill = readFileSync(skillPath, "utf8");
  const workflow = readFileSync(workflowPath, "utf8");

  // Assert
  assert.equal(existsSync(skillPath), true);
  assert.match(skill, /name: git-commit/u);
  assert.match(workflow, /name: la-briguade-just-do-it/u);
  assert.match(workflow, /user-invocable: true/u);
});
