import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(packageDir);
const sourceContent = join(repositoryRoot, "content");
const packagedContent = join(packageDir, "content");
const packagedPresets = join(packageDir, "presets");
const primaryPersonas = [
  ["builder", "Builder.md"],
  ["orchestrator", "Orchestrator.md"],
  ["planner", "Planner.md"],
  ["ask", "Ask.md"],
];

if (!existsSync(sourceContent)) {
  throw new Error(`Cannot prepare DSH package: missing ${sourceContent}`);
}

rmSync(packagedContent, { recursive: true, force: true });
cpSync(join(sourceContent, "skills"), join(packagedContent, "skills"), { recursive: true });

const justDoIt = parseMarkdown(readFileSync(join(sourceContent, "commands", "just-do-it.md"), "utf8"));
const workflowContent = [
  "---",
  "name: la-briguade-just-do-it",
  "description: Run la-briguade's autonomous implementation workflow in DeepSeek Harness.",
  "user-invocable: true",
  "disable-model-invocation: false",
  "---",
  "",
  "# la-briguade implementation workflow",
  "",
  "Use this workflow when the user asks for an autonomous end-to-end implementation.",
  "",
  justDoIt.body,
].join("\n");
writeFile(join(packagedContent, "workflows", "just-do-it", "SKILL.md"), workflowContent);

rmSync(packagedPresets, { recursive: true, force: true });
for (const [id, filename] of primaryPersonas) {
  const parsed = parseMarkdown(readFileSync(join(sourceContent, "agents", filename), "utf8"));
  const description = typeof parsed.attributes.description === "string"
    ? parsed.attributes.description
    : `la-briguade ${id} persona`;
  const presetDir = join(packagedPresets, id);
  mkdirSync(presetDir, { recursive: true });
  writeFile(join(presetDir, "preset.yml"), [
    `name: ${id}`,
    `description: ${JSON.stringify(description)}`,
    "order: 100",
    "",
  ].join("\n"));
  writeFile(join(presetDir, "agent.cordis.yml"), [
    "- id: la-briguade-persona",
    "  name: '@deepseek-ai/dsh-persona'",
    "  config:",
    "    prefix: |-",
    ...parsed.body.split("\n").map((line) => `      ${line}`),
    "",
  ].join("\n"));
}

function parseMarkdown(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(raw);
  if (match === null) return { attributes: {}, body: raw };
  const attributes = parse(match[1]);
  return {
    attributes: attributes !== null && typeof attributes === "object" && !Array.isArray(attributes)
      ? attributes
      : {},
    body: match[2],
  };
}

function writeFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}
