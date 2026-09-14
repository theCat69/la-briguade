#!/usr/bin/env node
import { lstatSync, cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const command = process.argv[2] ?? "help";

if (command === "smoke") {
  const result = spawnSync(process.execPath, [join(packageDir, "scripts", "smoke.mjs")], { stdio: "inherit" });
  if (result.error) throw new Error(`Unable to run model-free smoke test: ${result.error.message}`);
  process.exitCode = result.status ?? 1;
} else if (command === "install") {
  installBundle(resolve(process.argv[3] ?? process.cwd()));
} else {
  console.error("Usage: la-briguade-codex install [directory] | smoke");
  process.exitCode = 1;
}

function installBundle(target) {
  assertDirectory(target, "install target");
  const instructionsPath = join(target, "AGENTS.md");
  if (existsSync(instructionsPath)) {
    throw new Error(`Refusing to overwrite existing ${instructionsPath}; merge the bundle instructions manually.`);
  }
  const agentsRoot = join(target, ".agents");
  assertSafeDestination(agentsRoot, target);
  const skillsDestination = join(agentsRoot, "skills");
  const personasDestination = join(agentsRoot, "personas");
  assertSafeDestination(skillsDestination, target);
  assertSafeDestination(personasDestination, target);
  mkdirSync(agentsRoot, { recursive: true });
  cpSync(join(packageDir, "skills"), skillsDestination, { recursive: true, force: true });
  cpSync(join(packageDir, "agents"), personasDestination, { recursive: true, force: true });
  cpSync(join(packageDir, "AGENTS.md"), instructionsPath, { force: false });
  console.log(`Installed la-briguade Codex artifacts into ${target}`);
}

function assertSafeDestination(path, target) {
  if (relative(target, path).startsWith("..")) throw new Error(`Destination escapes install target: ${path}`);
  if (existsSync(path)) assertTreeHasNoSymlinks(path);
}

function assertDirectory(path, label) {
  const stats = lstatSync(path);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error(`${label} must be a real directory: ${path}`);
}

function assertTreeHasNoSymlinks(path) {
  const stats = lstatSync(path);
  if (stats.isSymbolicLink()) throw new Error(`Refusing symlink in install destination: ${path}`);
  if (!stats.isDirectory()) return;
  for (const entry of readdirSync(path)) assertTreeHasNoSymlinks(join(path, entry));
}
