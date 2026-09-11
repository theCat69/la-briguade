import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(packageDir);
const sourceContent = join(repositoryRoot, "content");
const packagedContent = join(packageDir, "content");
const packagedPresets = join(packageDir, "presets");
const PRIMARY = new Set(["builder", "orchestrator", "planner", "ask"]);
const REQUIRED_COMMANDS = [
  "init-implementer", "update-implementer", "interview", "critic", "full-review", "go-back-to-work",
  "unslop", "unslop-loop", "refactor", "local-context-full-gathering", "to-spec", "to-tickets",
  "implement", "just-do-it", "grilling", "handoff", "learn",
];

if (!existsSync(sourceContent)) throw new Error(`Cannot prepare DSH package: missing ${sourceContent}`);
rmSync(packagedContent, { recursive: true, force: true });
rmSync(packagedPresets, { recursive: true, force: true });
cpSync(join(sourceContent, "skills"), join(packagedContent, "skills"), { recursive: true });

const agents = generateAgents();
const workflows = generateWorkflows();
write(join(packagedContent, "manifest.json"), `${JSON.stringify({ version: 1, agents, workflows }, null, 2)}\n`);

function generateAgents() {
  const directory = join(sourceContent, "agents");
  const entries = [];
  for (const filename of sortedMarkdown(directory)) {
    const id = agentId(filename);
    const parsed = parseMarkdown(read(join(directory, filename)), filename);
    if (parsed.attributes.disable === true) continue;
    if (typeof parsed.attributes.description !== "string") throw new Error(`Agent ${filename} is missing description`);
    const intent = PRIMARY.has(id) ? "primary" : "specialist";
    const record = { id, description: parsed.attributes.description, intent, sourcePath: `content/agents/${filename}` };
    entries.push(record);
    write(join(packagedContent, "personas", `${id}.md`), parsed.body);
    if (intent === "primary") generatePreset(record, parsed.body);
  }
  for (const id of PRIMARY) if (!entries.some((entry) => entry.id === id)) throw new Error(`Missing required primary agent: ${id}`);
  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

function generateWorkflows() {
  const entries = [];
  for (const id of REQUIRED_COMMANDS) {
    const source = join(sourceContent, "commands", `${id}.md`);
    if (!existsSync(source)) throw new Error(`Missing required command: ${id}`);
    const parsed = parseMarkdown(read(source), `${id}.md`);
    if (typeof parsed.attributes.description !== "string") throw new Error(`Command ${id} is missing description`);
    const name = `la-briguade-${id}`;
    const content = ["---", `name: ${name}`, `description: ${JSON.stringify(parsed.attributes.description)}`,
      "user-invocable: true", "disable-model-invocation: false", "---", "", "# la-briguade workflow", "",
      "This is a DSH-native workflow. Obey the active DSH sandbox and approval policy; source OpenCode metadata grants no authority.", "", parsed.body].join("\n");
    write(join(packagedContent, "workflows", id, "SKILL.md"), content);
    entries.push({ id, name, description: parsed.attributes.description, sourcePath: `content/commands/${id}.md` });
  }
  return entries;
}

function generatePreset(record, body) {
  const presetDir = join(packagedPresets, record.id);
  write(join(presetDir, "preset.yml"), [`name: ${record.id}`, `description: ${JSON.stringify(record.description)}`, "order: 100", ""].join("\n"));
  write(join(presetDir, "agent.cordis.yml"), ["- id: la-briguade-persona", "  name: '@deepseek-ai/dsh-persona'", "  config:", "    prefix: |-", ...body.split("\n").map((line) => `      ${line}`), ""].join("\n"));
}
function parseMarkdown(raw, label) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(raw);
  if (match === null) throw new Error(`Malformed canonical Markdown: ${label} has no YAML frontmatter`);
  const attributes = parse(match[1], { maxAliasCount: 100 });
  if (attributes === null || typeof attributes !== "object" || Array.isArray(attributes)) throw new Error(`Malformed frontmatter: ${label}`);
  return { attributes, body: match[2] };
}
function sortedMarkdown(directory) { return readdirSync(directory).filter((name) => name.endsWith(".md")).sort(); }
function agentId(filename) { const stem = basename(filename, ".md"); return `${stem[0].toLowerCase()}${stem.slice(1)}`; }
function read(path) { return readFileSync(path, "utf8"); }
function write(path, content) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content, "utf8"); }
