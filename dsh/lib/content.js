import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

import { parse } from "yaml";

export const MAX_CONTENT_LENGTH = 50_000;
export const SAFE_IDENTIFIER = /^[a-z][a-z0-9-]*$/u;
const POISON_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Parse bounded canonical Markdown without treating source metadata as authority. */
export function parseMarkdown(raw, sourcePath, diagnostics = []) {
  if (typeof raw !== "string" || raw.length > MAX_CONTENT_LENGTH) {
    diagnostics.push(diagnostic(sourcePath, "content exceeds the 50,000-character limit"));
    return undefined;
  }
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(raw);
  if (match === null) return { attributes: {}, body: raw, sourcePath };
  try {
    const value = parse(match[1], { maxAliasCount: 100 });
    if (!isRecord(value)) {
      diagnostics.push(diagnostic(sourcePath, "frontmatter must be an object"));
      return undefined;
    }
    const attributes = Object.fromEntries(
      Object.entries(value).filter(([key]) => !POISON_KEYS.has(key)),
    );
    return { attributes, body: match[2], sourcePath };
  } catch (error) {
    diagnostics.push(diagnostic(sourcePath, `invalid YAML (${errorMessage(error)})`));
    return undefined;
  }
}

export function readMarkdown(path, diagnostics = []) {
  try {
    if (lstatSync(path).isSymbolicLink()) {
      diagnostics.push(diagnostic(path, "symlinked content is not accepted"));
      return undefined;
    }
    const raw = readFileSync(path, "utf8");
    return parseMarkdown(raw, path, diagnostics);
  } catch (error) {
    diagnostics.push(diagnostic(path, `cannot read content (${errorMessage(error)})`));
    return undefined;
  }
}

export function listMarkdown(directory, diagnostics = []) {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => join(directory, basename(entry.name)))
      .sort();
  } catch (error) {
    diagnostics.push(diagnostic(directory, `cannot list content (${errorMessage(error)})`));
    return [];
  }
}

export function normalizeAgent(parsed, id) {
  if (!SAFE_IDENTIFIER.test(id)) return undefined;
  const { attributes, body, sourcePath } = parsed;
  const description = typeof attributes.description === "string" ? attributes.description : `la-briguade ${id}`;
  return {
    id,
    description: description.slice(0, 500),
    body,
    intent: attributes.mode === "subagent" || attributes.hidden === true ? "specialist" : "primary",
    disabled: attributes.disable === true,
    modelHint: stringOrUndefined(attributes.model),
    variantHint: stringOrUndefined(attributes.variant),
    temperatureHint: boundedNumber(attributes.temperature),
    topPHint: boundedNumber(attributes.top_p),
    maxStepsHint: integerOrUndefined(attributes.maxSteps),
    sourcePath,
  };
}

export function normalizeCommand(parsed, id) {
  if (!SAFE_IDENTIFIER.test(id)) return undefined;
  const { attributes, body, sourcePath } = parsed;
  return {
    id,
    description: typeof attributes.description === "string" ? attributes.description.slice(0, 500) : `la-briguade ${id} workflow`,
    body,
    agentHint: stringOrUndefined(attributes.agent),
    modelHint: stringOrUndefined(attributes.model),
    subtaskHint: attributes.subtask === true,
    sourcePath,
  };
}

export function resolveContentRoots(packageRoot, configuredRoots, diagnostics = []) {
  const roots = [packageRoot];
  for (const root of configuredRoots ?? []) {
    if (typeof root !== "string" || root.length === 0) continue;
    const resolved = resolve(root);
    if (!existsSync(resolved) || !isContained(resolved, resolved)) {
      diagnostics.push(diagnostic(root, "configured content root is unavailable"));
      continue;
    }
    try {
      if (lstatSync(resolved).isSymbolicLink()) {
        diagnostics.push(diagnostic(root, "symlinked content root is not accepted"));
        continue;
      }
      roots.push(resolved);
    } catch {
      diagnostics.push(diagnostic(root, "configured content root cannot be inspected"));
    }
  }
  return roots;
}

export function isContained(root, candidate) {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== "..");
}

export function diagnostic(sourcePath, message) {
  return { sourcePath: basename(String(sourcePath)), message };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function stringOrUndefined(value) {
  return typeof value === "string" && value.length <= 500 ? value : undefined;
}
function boundedNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 2 ? value : undefined;
}
function integerOrUndefined(value) {
  return Number.isInteger(value) && value > 0 && value <= 10_000 ? value : undefined;
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
