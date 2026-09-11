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

// DSH Web disables these model-facing rows in the host composition. Every
// selectable la-briguade primary preset must mount its own scoped copy.
const STANDARD_AGENT_ROWS = `
- id: agent-instructions
  name: '@deepseek-ai/dsh-agent-instructions'
  config:
    maxBytes: 65536
- id: tool-bash
  name: '@deepseek-ai/dsh-tool-bash'
  disabled: !!js process.platform === 'win32'
- id: tool-pwsh
  name: '@deepseek-ai/dsh-tool-pwsh'
  disabled: !!js process.platform !== 'win32'
- id: tool-fs
  name: '@deepseek-ai/dsh-tool-fs'
- id: tool-fs-search
  name: '@deepseek-ai/dsh-tool-fs-search'
  config:
    sampleOverCapGlobResults: false
- id: tool-jobs
  name: '@deepseek-ai/dsh-tool-jobs'
- id: skill-filesystem
  name: '@deepseek-ai/dsh-skill-filesystem'
- id: tool-skill
  name: '@deepseek-ai/dsh-tool-skill'
- id: command-goal
  name: '@deepseek-ai/dsh-command-goal'
- id: tool-goal
  name: '@deepseek-ai/dsh-tool-goal'
- id: planning
  name: cordis:group
  group: true
  isolate:
    planMode: true
  config:
    - id: plan-mode
      name: '@deepseek-ai/dsh-plan-mode'
      config:
        section: |-
          You are in plan mode. Explore and inspect the repository before proposing an implementation plan; do not edit files, change configuration, commit, or otherwise implement changes.

          Use non-mutating tools to resolve discoverable facts. Ask the user only about material ambiguity or choices they own.

          Make the plan decision-complete: explain the goal, affected areas, implementation steps, tests, edge cases, and assumptions. When ready, call exit_plan_mode with the complete Markdown plan starting with a # title. It must be the final tool call in the response; implementation starts only after user approval.
- id: compaction
  name: cordis:group
  group: true
  isolate:
    compaction: true
    toolResultPruner: true
  config:
    - id: compaction-basic
      name: '@deepseek-ai/dsh-compaction-basic'
    - id: command-compact
      name: '@deepseek-ai/dsh-command-compact'
    - id: tool-result-pruner
      name: '@deepseek-ai/dsh-compaction-tool-result-pruner'
- id: delegation
  name: cordis:group
  group: true
  isolate:
    workflowEngine: true
  config:
    - id: tool-subagent-control
      name: '@deepseek-ai/dsh-tool-subagent-control'
    - id: tool-subagent-list-agents
      name: '@deepseek-ai/dsh-tool-subagent-control/list-agents'
    - id: tool-subagent
      name: '@deepseek-ai/dsh-tool-subagent'
      config:
        provider: spawn
        toolName: subagent
        backgroundMode: continuable
    - id: tool-subagent-fork
      name: '@deepseek-ai/dsh-tool-subagent'
      config:
        provider: fork
        toolName: subagent_fork
        backgroundMode: continuable
    - id: workflow-worker-thread
      name: '@deepseek-ai/dsh-workflow-worker-thread'
      config:
        provider: spawn
    - id: tool-workflow
      name: '@deepseek-ai/dsh-tool-workflow'
    - id: tool-ralph
      name: '@deepseek-ai/dsh-tool-ralph'
      config:
        subagentProvider: spawn
        maxRounds: 64
- id: tool-ask-user
  name: '@deepseek-ai/dsh-tool-ask-user'
- id: tool-todo
  name: '@deepseek-ai/dsh-tool-todo'
  config:
    allowParallelInProgress: true
- id: tool-web
  name: '@deepseek-ai/dsh-tool-web'
  config:
    fetch: true
    searchTimeoutMs: 60000
- id: present
  name: '@deepseek-ai/dsh-tool-present'
`;

if (!existsSync(sourceContent)) throw new Error(`Cannot prepare DSH package: missing ${sourceContent}`);
rmSync(packagedContent, { recursive: true, force: true });
rmSync(packagedPresets, { recursive: true, force: true });
cpSync(join(sourceContent, "skills"), join(packagedContent, "skills"), { recursive: true });
cpSync(join(sourceContent, "auto-inject-skills"), join(packagedContent, "auto-inject-skills"), { recursive: true });

const agents = generateAgents();
const workflows = generateWorkflows();
const autoInjectSkills = generateAutoInjectSkills();
const skillMcps = generateSkillMcps();
write(join(packagedContent, "manifest.json"), `${JSON.stringify({ version: 1, agents, workflows, autoInjectSkills, skillMcps }, null, 2)}\n`);

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

function generateAutoInjectSkills() {
  const directory = join(sourceContent, "auto-inject-skills");
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^[a-z][a-z0-9-]*$/u.test(entry.name))
    .map((entry) => ({ id: entry.name, sourcePath: `content/auto-inject-skills/${entry.name}/SKILL.md` }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
function generateSkillMcps() {
  const directory = join(sourceContent, "skills");
  const entries = [];
  for (const skill of readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^[a-z][a-z0-9-]*$/u.test(entry.name)).map((entry) => entry.name).sort()) {
    const parsed = parseMarkdown(read(join(directory, skill, "SKILL.md")), `${skill}/SKILL.md`);
    const declarations = parsed.attributes.mcp;
    if (declarations === null || typeof declarations !== "object" || Array.isArray(declarations)) continue;
    for (const [key, declaration] of Object.entries(declarations)) {
      if (!/^[A-Za-z0-9_-]{1,32}$/u.test(key) || declaration === null || typeof declaration !== "object" || Array.isArray(declaration)) continue;
      const type = declaration.type;
      if (type !== "local" && type !== "remote") continue;
      entries.push({ skill, key, transport: type === "local" ? "stdio" : "streamable-http" });
    }
  }
  return entries.sort((left, right) => `${left.skill}:${left.key}`.localeCompare(`${right.skill}:${right.key}`));
}
function generatePreset(record, body) {
  const presetDir = join(packagedPresets, record.id);
  write(join(presetDir, "preset.yml"), [`name: ${record.id}`, `description: ${JSON.stringify(record.description)}`, "order: 100", ""].join("\n"));
  write(join(presetDir, "agent.cordis.yml"), ["- id: la-briguade-persona", "  name: '@deepseek-ai/dsh-persona'", "  config:", "    prefix: |-", ...body.split("\n").map((line) => `      ${line}`), "- id: la-briguade-auto-inject", "  name: la-briguade-dsh/auto-inject", "  config:", `    persona: ${record.id}`, STANDARD_AGENT_ROWS.trim(), ""].join("\n"));
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
