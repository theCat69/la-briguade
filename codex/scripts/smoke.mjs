import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = join(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(readFileSync(join(packageDir, "manifest.json"), "utf8"));
const required = ["builder", "orchestrator", "planner", "ask"];
for (const id of required) {
  if (!manifest.agents.some((entry) => entry.id === id && entry.intent === "primary")) throw new Error(`Missing primary persona: ${id}`);
  if (!existsSync(join(packageDir, "agents", `${id}.md`))) throw new Error(`Missing persona prompt: ${id}`);
}
if (manifest.workflows.length !== 17) throw new Error(`Expected 17 workflows, found ${manifest.workflows.length}`);
for (const workflow of manifest.workflows) {
  if (!existsSync(join(packageDir, "skills", workflow.name, "SKILL.md"))) throw new Error(`Missing workflow skill: ${workflow.name}`);
}
if (!existsSync(join(packageDir, "AGENTS.md"))) throw new Error("Missing Codex instructions");
if (!existsSync(join(packageDir, "config.toml"))) throw new Error("Missing Codex configuration template");
console.log(`Codex model-free smoke test passed: ${manifest.agents.length} agents, ${manifest.workflows.length} workflows, ${manifest.mcp.length} MCP declarations.`);
