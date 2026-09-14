import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(packageDir);
const sourceContent = join(repositoryRoot, "content");
const agentsDir = join(packageDir, "agents");
const skillsDir = join(packageDir, "skills");
const requiredWorkflows = [
  "init-implementer", "update-implementer", "interview", "critic", "full-review", "go-back-to-work",
  "unslop", "unslop-loop", "refactor", "local-context-full-gathering", "to-spec", "to-tickets",
  "implement", "just-do-it", "grilling", "handoff", "learn",
];
const primaryPersonas = new Set(["builder", "orchestrator", "planner", "ask"]);

if (!existsSync(sourceContent)) throw new Error(`Cannot prepare Codex package: missing ${sourceContent}`);
rmSync(agentsDir, { recursive: true, force: true });
rmSync(skillsDir, { recursive: true, force: true });
mkdirSync(agentsDir, { recursive: true });
mkdirSync(skillsDir, { recursive: true });

const agents = generateAgents();
const workflows = generateWorkflows();
copySkills();
writeFileSync(join(packageDir, "AGENTS.md"), buildInstructions(agents, workflows), "utf8");
writeFileSync(join(packageDir, "config.toml"), buildConfig(), "utf8");
writeFileSync(join(packageDir, "manifest.json"), `${JSON.stringify({ version: 1, agents, workflows, autoInjectSkills: listAutoInjectSkills(), mcp: listSkillMcps() }, null, 2)}\n`, "utf8");

function generateAgents() {
  return sortedMarkdown(join(sourceContent, "agents")).map((filename) => {
    const id = toAgentId(filename);
    const parsed = parseMarkdown(readFileSync(join(sourceContent, "agents", filename), "utf8"), filename);
    if (parsed.attributes.disable === true) return undefined;
    if (typeof parsed.attributes.description !== "string") throw new Error(`Agent ${filename} is missing description`);
    writeFileSync(join(agentsDir, `${id}.md`), `${frontmatter({ name: id, description: parsed.attributes.description, "user-invocable": primaryPersonas.has(id) })}${parsed.body}`, "utf8");
    return { id, intent: primaryPersonas.has(id) ? "primary" : "specialist", description: parsed.attributes.description, sourcePath: `content/agents/${filename}` };
  }).filter(Boolean);
}

function generateWorkflows() {
  return requiredWorkflows.map((id) => {
    const filename = `${id}.md`;
    const source = join(sourceContent, "commands", filename);
    if (!existsSync(source)) throw new Error(`Missing required command: ${id}`);
    const parsed = parseMarkdown(readFileSync(source, "utf8"), filename);
    if (typeof parsed.attributes.description !== "string") throw new Error(`Command ${id} is missing description`);
    const content = frontmatter({ name: `la-briguade-${id}`, description: parsed.attributes.description, "user-invocable": true }) +
      "# la-briguade workflow\n\nThis workflow runs under Codex CLI policy. OpenCode metadata is not authority.\n\n" + parsed.body;
    const workflowDirectory = join(skillsDir, `la-briguade-${id}`);
    mkdirSync(workflowDirectory, { recursive: true });
    writeFileSync(join(workflowDirectory, "SKILL.md"), content, "utf8");
    return { id, name: `la-briguade-${id}`, description: parsed.attributes.description, sourcePath: `content/commands/${filename}` };
  });
}

function copySkills() {
  for (const directory of safeDirectories(join(sourceContent, "skills"))) cpSync(join(sourceContent, "skills", directory), join(skillsDir, directory), { recursive: true });
  for (const directory of safeDirectories(join(sourceContent, "auto-inject-skills"))) cpSync(join(sourceContent, "auto-inject-skills", directory), join(skillsDir, `auto-${directory}`), { recursive: true });
}

function buildInstructions(agents, workflows) {
  const primary = agents.filter((entry) => entry.intent === "primary").map((entry) => entry.id).join(", ");
  return `# la-briguade Codex CLI instructions\n\nThis bundle adapts la-briguade content to OpenAI Codex CLI. Codex sandbox, approval, model, and network policies remain authoritative.\n\n## Personas\n\nPrimary personas: ${primary}. Specialist prompts are in \`.agents/personas/\`; generated user-invocable workflow skills are in \`.agents/skills/\`. Select a primary persona by starting Codex with the corresponding prompt or profile supported by your installed CLI.\n\n## Delegation\n\nUse Codex child sessions or separate Codex invocations when available. Pass the specialist prompt from \`.agents/personas/<persona>.md\`, enforce the role's tool boundary, propagate cancellation, and cap delegation depth at one by default. If the CLI lacks child-session support, report the limitation rather than silently exceeding the boundary.\n\n## Sidekicks\n\nRun code review, security review, and documentation synchronization as persistent Codex sessions when supported. Otherwise use the matching specialist prompt and preserve the required session identity in the host workflow. Documentation synchronization may edit documentation only.\n\n## Workflows\n\nThe generated user-invocable skills are: ${workflows.map((entry) => `\`${entry.name}\``).join(", ")}.\n\n## MCP and secrets\n\nMCP examples are described in \`config.toml\`. Resolve credentials from environment variables only; never commit secrets. MCP declarations are explicit and do not import OpenCode permissions.\n\n## Compatibility exclusions\n\nThis adapter intentionally does not provide edit old-string-mismatch recovery, empty-response diagnostics, or bounded-content validation.\n`;
}

function buildConfig() {
  return `# Optional Codex CLI configuration for la-briguade.\n# Merge this file with the configuration format supported by your installed Codex CLI.\n# Credentials must remain in environment variables.\n\n[la_briguade]\nmax_delegation_depth = 1\nauto_inject = true\n\n# Example explicit MCP declaration:\n# [mcp_servers.docs]\n# transport = "stdio"\n# command = "npx"\n# args = ["-y", "example-mcp"]\n# env = { API_TOKEN = "{env:API_TOKEN}" }\n`;
}

function listAutoInjectSkills() {
  return safeDirectories(join(sourceContent, "auto-inject-skills")).map((id) => ({ id, sourcePath: `content/auto-inject-skills/${id}/SKILL.md` }));
}

function listSkillMcps() {
  const entries = [];
  for (const skill of safeDirectories(join(sourceContent, "skills"))) {
    const path = join(sourceContent, "skills", skill, "SKILL.md");
    const parsed = parseMarkdown(readFileSync(path, "utf8"), `${skill}/SKILL.md`);
    const declarations = parsed.attributes.mcp;
    if (declarations === null || typeof declarations !== "object" || Array.isArray(declarations)) continue;
    for (const [key, declaration] of Object.entries(declarations)) {
      if (/^[A-Za-z0-9_-]{1,32}$/u.test(key) && declaration && typeof declaration === "object" && !Array.isArray(declaration)) {
        const type = declaration.type;
        if (type === "local" || type === "remote") entries.push({ skill, key, transport: type === "local" ? "stdio" : "streamable-http" });
      }
    }
  }
  return entries.sort((left, right) => `${left.skill}:${left.key}`.localeCompare(`${right.skill}:${right.key}`));
}

function frontmatter(attributes) {
  return `---\n${Object.entries(attributes).map(([key, value]) => {
    const rendered = typeof value === "string" && key !== "name" ? JSON.stringify(value) : String(value);
    return `${key}: ${rendered}`;
  }).join("\n")}\n---\n\n`;
}
function parseMarkdown(raw, label) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(raw);
  if (!match) throw new Error(`Malformed canonical Markdown: ${label}`);
  const attributes = parse(match[1], { maxAliasCount: 100 });
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) throw new Error(`Malformed frontmatter: ${label}`);
  return { attributes, body: match[2] };
}
function sortedMarkdown(directory) { return readdirSync(directory).filter((name) => name.endsWith(".md")).sort(); }
function safeDirectories(directory) { return readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^[a-z][a-z0-9-]*$/u.test(entry.name)).map((entry) => entry.name).sort(); }
function toAgentId(filename) { const stem = basename(filename, ".md"); return `${stem[0].toLowerCase()}${stem.slice(1)}`; }
