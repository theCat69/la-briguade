import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, symlinkSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageDir = join(fileURLToPath(new URL("..", import.meta.url)));
const installer = join(packageDir, "bin", "la-briguade-codex.js");

function runInstaller(...args) {
  return spawnSync(process.execPath, [installer, ...args], { encoding: "utf8" });
}

test("should install into Codex skill and persona directories", () => {
  const target = mkdtempSync(join(tmpdir(), "la-briguade-codex-install-"));
  try {
    const result = runInstaller("install", target);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(target, "AGENTS.md")), true);
    assert.equal(existsSync(join(target, ".agents", "skills", "la-briguade-critic", "SKILL.md")), true);
    assert.equal(existsSync(join(target, ".agents", "personas", "builder.md")), true);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test("should reject unsafe symlink destinations before writing", () => {
  const target = mkdtempSync(join(tmpdir(), "la-briguade-codex-symlink-"));
  const outside = mkdtempSync(join(tmpdir(), "la-briguade-codex-outside-"));
  try {
    symlinkSync(outside, join(target, ".agents"));
    const result = runInstaller("install", target);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /symlink/u);
    assert.equal(existsSync(join(outside, "skills")), false);
    assert.equal(existsSync(join(target, "AGENTS.md")), false);
  } finally {
    rmSync(target, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("should refuse an existing AGENTS file before creating destinations", () => {
  const target = mkdtempSync(join(tmpdir(), "la-briguade-codex-existing-"));
  try {
    writeFileSync(join(target, "AGENTS.md"), "existing\n");
    const result = runInstaller("install", target);
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(join(target, ".agents")), false);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});
