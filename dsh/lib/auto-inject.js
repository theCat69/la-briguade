import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import z from "@deepseek-ai/schemastery";
import { parse } from "yaml";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const contentDir = join(packageDir, "content", "auto-inject-skills");
const START_MARKER = "<auto-injected-skills>";
const END_MARKER = "</auto-injected-skills>";
const PREFACE = "The following content is already-loaded auto-injected skills. Each skill is shown as '#skill-name', then description, then body.";
const IGNORED_DIRECTORIES = new Set([".cache", ".git", ".next", ".turbo", ".venv", ".yarn", "build", "coverage", "dist", "node_modules", "target", "vendor"]);
const MAX_SKILL_BYTES = 50_000;
const MAX_DIRECTORIES = 1_000;
const MAX_CANDIDATES = 2_000;
const MAX_FILE_READS = 100;
const MAX_DETECTION_BYTES = 1_000_000;
const MAX_PROMPT_BYTES = 50_000;
const MAX_DIRECTORY_ENTRIES = 1_000;

export const name = "la-briguade-auto-inject";
export const inject = ["systemPrompt", "fs", "tools", "agents", "laBriguadeAutoInject"];
export const Config = z.object({ persona: z.string().pattern(/^[a-z][a-z0-9-]*$/u).required() });

/** Read the generated, bundled catalog only; workspace inspection is exclusively through ctx.fs. */
export function createAutoInjectRuntime(config) {
  const diagnostics = [];
  const catalog = loadCatalog(diagnostics);
  const detectorNames = new Set();
  for (const entry of catalog) {
    for (const path of [...entry.detectFiles, ...entry.detectContent.map((item) => item.file)]) {
      const name = detectionBasename(path);
      if (name !== undefined) detectorNames.add(name);
    }
  }
  const personaBySession = new Map();
  return {
    catalog,
    diagnostics,
    enabled: config.enabled,
    maxDepth: config.maxDepth,
    detectorNames,
    setPersona(sessionId, persona) { if (typeof sessionId === "string") personaBySession.set(sessionId, persona); },
    clearPersona(sessionId) { if (typeof sessionId === "string") personaBySession.delete(sessionId); },
    personaFor(agent, fallback) { return personaBySession.get(agent?.session?.header?.id ?? agent?.id) ?? fallback; },
    status() {
      return {
        enabled: config.enabled,
        maxDepth: config.maxDepth,
        bundledEntries: catalog.length,
        diagnostics: diagnostics.slice(0, 50),
      };
    },
  };
}

/** Mount inside a la-briguade preset scope only. */
export function apply(ctx, input = {}) {
  const config = Config(input);
  const runtime = ctx.laBriguadeAutoInject;
  const cache = new Map();
  const resolve = async (agent, signal) => {
    if (!runtime.enabled || agent === undefined) return "";
    const cwd = agent.session?.header?.cwd;
    if (typeof cwd !== "string" || cwd.length === 0) return "";
    let root;
    try {
      root = await ctx.fs.resolve(cwd, { signal });
      if ((await ctx.fs.stat(root, signal))?.type !== "directory") return "";
    } catch {
      note(runtime, "workspace unavailable for auto-inject detection");
      return "";
    }
    const sessionId = agent.session?.header?.id ?? agent.id;
    const preset = agent.session?.header?.agentPreset ?? config.persona;
    const persona = runtime.personaFor(agent, config.persona);
    const current = cache.get(sessionId);
    if (current?.rootKey === root.targetKey && current.preset === preset && current.depth === runtime.maxDepth) {
      const resolved = current.pending === undefined ? current : await current.pending;
      return render(runtime.catalog, resolved.active, persona);
    }
    const pending = (async () => {
      const parent = parentEntry(ctx, cache, agent, root.targetKey, preset, runtime.maxDepth);
      const parentResolved = parent?.pending === undefined ? parent : await parent.pending;
      const active = parentResolved?.active ?? await detect(ctx.fs, root, runtime.catalog, runtime.maxDepth, signal, runtime);
      return { rootKey: root.targetKey, preset, depth: runtime.maxDepth, active };
    })();
    cache.set(sessionId, { rootKey: root.targetKey, preset, depth: runtime.maxDepth, pending });
    try {
      const resolved = await pending;
      cache.set(sessionId, resolved);
      return render(runtime.catalog, resolved.active, persona);
    } catch (error) {
      cache.delete(sessionId);
      throw error;
    }
  };
  const assemblyDispose = ctx.on("system-prompt/assemble", async (assembly, context, next) => {
    const downstream = await next();
    const text = await resolve(context.agent, context.signal);
    const index = downstream.sections.findIndex((section) => section.name === "deployment:persona-prefix");
    const withoutPrevious = downstream.sections.filter((section) => section.name !== "la-briguade:auto-injected-skills");
    if (text.length === 0) return { ...downstream, sections: withoutPrevious };
    const insertion = index < 0 ? 0 : withoutPrevious.findIndex((section) => section.name === "deployment:persona-prefix") + 1;
    withoutPrevious.splice(Math.max(0, insertion), 0, { name: "la-briguade:auto-injected-skills", text });
    return { ...downstream, sections: withoutPrevious };
  });
  const agentDispose = ctx.on("agent/disposed", ({ agent }) => {
    const sessionId = agent.session?.header?.id ?? agent.id;
    cache.delete(sessionId);
    runtime.clearPersona(sessionId);
  });
  const postDispose = ctx.on("tools/post-execute", async (exec, result, next) => {
    const decision = await next();
    if (result.isError || (exec.name !== "write" && exec.name !== "edit") || exec.agent === undefined) return decision;
    const path = exec.arguments?.file_path;
    if (typeof path !== "string" || !runtime.detectorNames.has(basename(path))) return decision;
    const cwd = exec.agent.session?.header?.cwd;
    if (typeof cwd !== "string") return decision;
    try {
      const [root, changed] = await Promise.all([ctx.fs.resolve(cwd, { signal: exec.signal }), ctx.fs.resolve(path, { cwd, signal: exec.signal })]);
      if (!ctx.fs.contains(root, changed)) return decision;
      for (const [id, entry] of cache) if (entry.rootKey === root.targetKey) cache.delete(id);
    } catch { note(runtime, "could not invalidate auto-inject detection after a workspace write"); }
    return decision;
  });
  return () => {
    cache.clear();
    assemblyDispose();
    agentDispose();
    postDispose();
  };
}

function parentEntry(ctx, cache, agent, rootKey, preset, depth) {
  const parentId = agent.session?.header?.parentSession;
  if (parentId === undefined || typeof ctx.agents?.get !== "function") return undefined;
  try {
    const parent = ctx.agents.get(parentId);
    const parentSessionId = parent?.session?.header?.id ?? parent?.id;
    const entry = cache.get(parentSessionId);
    return entry?.rootKey === rootKey && entry.preset === preset && entry.depth === depth ? entry : undefined;
  } catch { return undefined; }
}

async function detect(fs, root, catalog, maxDepth, signal, runtime) {
  const names = new Set();
  for (const entry of catalog) for (const path of [...entry.detectFiles, ...entry.detectContent.map((item) => item.file)]) {
    const name = detectionBasename(path);
    if (name !== undefined) names.add(name);
  }
  const pathsByName = new Map();
  const queue = [{ target: root, depth: 0, relative: "" }];
  let directories = 0;
  let candidates = 0;
  let enqueuedDirectories = 1;
  while (queue.length > 0 && directories < MAX_DIRECTORIES && candidates < MAX_CANDIDATES) {
    const current = queue.shift();
    if (current === undefined) break;
    directories += 1;
    let entries;
    try { entries = await fs.listDir(current.target, signal); }
    catch { note(runtime, "workspace directory could not be inspected for auto-inject detection"); continue; }
    for (const entry of entries.slice(0, MAX_DIRECTORY_ENTRIES)) {
      if (!fs.contains(root, entry.target)) continue;
      if (entry.type === "file" && names.has(entry.name)) {
        const matches = pathsByName.get(entry.name) ?? [];
        if (candidates < MAX_CANDIDATES) {
          matches.push({ target: entry.target, relative: current.relative === "" ? entry.name : `${current.relative}/${entry.name}` });
          candidates += 1;
        }
        pathsByName.set(entry.name, matches);
      } else if (entry.type === "directory" && current.depth < maxDepth && !IGNORED_DIRECTORIES.has(entry.name) && enqueuedDirectories < MAX_DIRECTORIES) {
        queue.push({ target: entry.target, depth: current.depth + 1, relative: current.relative === "" ? entry.name : `${current.relative}/${entry.name}` });
        enqueuedDirectories += 1;
      }
    }
  }
  if (queue.length > 0) note(runtime, "auto-inject detection reached a traversal bound");
  const active = new Set();
  let readAttempts = 0;
  let bytes = 0;
  for (const entry of catalog) {
    if (entry.detectFiles.length === 0 && entry.detectContent.length === 0) { active.add(entry.id); continue; }
    if (entry.detectFiles.some((path) => hasFile(pathsByName, path))) { active.add(entry.id); continue; }
    for (const condition of entry.detectContent) {
      for (const candidate of matchingCandidates(pathsByName, condition.file)) {
        if (readAttempts >= MAX_FILE_READS || bytes >= MAX_DETECTION_BYTES) break;
        readAttempts += 1;
        try {
          const info = await fs.stat(candidate.target, signal);
          if (info?.type !== "file" || (info.size !== undefined && info.size > MAX_SKILL_BYTES)) continue;
          const raw = await fs.readBytes(candidate.target, signal, MAX_SKILL_BYTES);
          bytes += raw.byteLength;
          if (new TextDecoder("utf-8", { fatal: true }).decode(raw).includes(condition.contains)) { active.add(entry.id); break; }
        } catch { /* An unavailable or non-text candidate is a non-match. */ }
      }
      if (active.has(entry.id)) break;
    }
  }
  if (readAttempts >= MAX_FILE_READS || bytes >= MAX_DETECTION_BYTES) note(runtime, "auto-inject detection reached its file-read bound");
  return active;
}

function hasFile(pathsByName, path) { return matchingCandidates(pathsByName, path).length > 0; }
function matchingCandidates(pathsByName, path) {
  const candidates = pathsByName.get(detectionBasename(path)) ?? [];
  return path.includes("/") || path.includes("\\") ? candidates.filter((candidate) => candidate.relative === path.replaceAll("\\", "/")) : candidates;
}
function detectionBasename(path) {
  if (typeof path !== "string" || path.length === 0 || path.startsWith("/") || path.startsWith("\\") || /^[A-Za-z]:[\\/]/u.test(path) || path.split(/[\\/]+/u).some((part) => part === "" || part === "." || part === "..")) return undefined;
  return basename(path);
}
function render(catalog, active, persona) {
  const entries = catalog.filter((entry) => active.has(entry.id) && entry.body.length > 0 && entry.agents.includes(persona));
  if (entries.length === 0) return "";
  const sections = [];
  let bytes = new TextEncoder().encode(`${START_MARKER}\n${PREFACE}\n\n${END_MARKER}`).byteLength;
  for (const entry of entries) {
    const section = `#${entry.id}\n${entry.description}\n${entry.body}`;
    const nextBytes = new TextEncoder().encode(section).byteLength + (sections.length > 0 ? 2 : 0);
    if (bytes + nextBytes > MAX_PROMPT_BYTES) break;
    sections.push(section);
    bytes += nextBytes;
  }
  return sections.length === 0 ? "" : [START_MARKER, PREFACE, "", sections.join("\n\n"), END_MARKER].join("\n");
}
function note(runtime, message) { if (!runtime.diagnostics.includes(message) && runtime.diagnostics.length < 50) runtime.diagnostics.push(message); }
function loadCatalog(diagnostics) {
  const entries = [];
  let directories = [];
  try { directories = readdirSync(contentDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^[a-z][a-z0-9-]*$/u.test(entry.name)).map((entry) => entry.name).sort(); }
  catch { diagnostics.push("bundled auto-inject catalog is unavailable"); return entries; }
  for (const id of directories) {
    const file = join(contentDir, id, "SKILL.md");
    try {
      if (statSync(file).size > MAX_SKILL_BYTES) throw new Error("exceeds size limit");
      const raw = readFileSync(file, "utf8");
      const parsed = parseSkill(raw);
      if (parsed === undefined) throw new Error("has invalid frontmatter");
      entries.push({ id, ...parsed });
    } catch { if (diagnostics.length < 50) diagnostics.push(`bundled auto-inject skill omitted: ${id}`); }
  }
  return entries;
}
function parseSkill(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(raw);
  if (match === null) return undefined;
  const attributes = parse(match[1]);
  if (attributes === null || typeof attributes !== "object" || Array.isArray(attributes)) return undefined;
  const agents = strings(attributes.agents);
  const description = typeof attributes.description === "string" ? attributes.description : "";
  const detect = attributes.detect !== null && typeof attributes.detect === "object" && !Array.isArray(attributes.detect) ? attributes.detect : {};
  const detectFiles = strings(detect.files).filter((value) => detectionBasename(value) !== undefined);
  const detectContent = Array.isArray(detect.content) ? detect.content.filter((value) => value !== null && typeof value === "object" && !Array.isArray(value) && typeof value.file === "string" && typeof value.contains === "string" && detectionBasename(value.file) !== undefined).map((value) => ({ file: value.file, contains: value.contains })) : [];
  return { agents, description, detectFiles, detectContent, body: match[2].trim() };
}
function strings(value) { return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : []; }
