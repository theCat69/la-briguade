import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageDir = join(fileURLToPath(new URL("..", import.meta.url)));

test("should validate the bundle without invoking Codex or a model", () => {
  const result = spawnSync(process.execPath, [join(packageDir, "scripts", "smoke.mjs")], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CODEX_MODEL: "must-not-be-used" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /model-free smoke test passed/u);
});
