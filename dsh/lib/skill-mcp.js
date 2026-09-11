import { readdirSync } from "node:fs";
import { join } from "node:path";

import { readMarkdown } from "./content.js";

const SERVER_NAME = /^[A-Za-z0-9_-]{1,32}$/u;
const UNSAFE_COMMAND_CHARS = /[;|&$`<>!]/u;
const MAX_SERVERS = 10;
const MAX_COMMAND_ARGS = 50;
const MAX_MAP_ENTRIES = 50;
const MAX_VALUE_LENGTH = 2_000;

/** Discover bounded MCP declarations from generated, package-owned skill files. */
export function collectBundledSkillMcps(skillsDir, diagnostics = []) {
  const servers = {};
  const provenance = [];
  for (const directory of safeDirectories(skillsDir)) {
    const parsed = readMarkdown(join(skillsDir, directory, "SKILL.md"), diagnostics);
    if (parsed === undefined) continue;
    const declarations = parsed.attributes.mcp;
    if (!isRecord(declarations)) continue;
    for (const [key, value] of Object.entries(declarations)) {
      if (Object.keys(servers).length >= MAX_SERVERS) {
        diagnostics.push(diagnostic(directory, "bundled skill MCP limit reached"));
        break;
      }
      if (!SERVER_NAME.test(key)) {
        diagnostics.push(diagnostic(directory, "MCP key is invalid"));
        continue;
      }
      if (servers[key] !== undefined) {
        diagnostics.push(diagnostic(directory, `duplicate bundled MCP key "${key}"`));
        continue;
      }
      const server = normalizeServer(value, directory, key, diagnostics);
      if (server === undefined) continue;
      servers[key] = server;
      provenance.push({ skill: directory, key, transport: server.transport });
    }
  }
  return { servers, provenance };
}

/** Explicit adapter config overrides bundled skill declarations by key. */
export function mergeSkillMcps(bundled, explicit = {}, diagnostics = []) {
  const effective = {};
  for (const key of Object.keys(explicit).sort()) effective[key] = explicit[key];
  for (const key of Object.keys(bundled).sort()) {
    if (effective[key] !== undefined) continue;
    if (Object.keys(effective).length >= MAX_SERVERS) {
      diagnostics.push(diagnostic(key, "total MCP server limit reached; bundled declaration skipped"));
      continue;
    }
    effective[key] = bundled[key];
  }
  return effective;
}

function normalizeServer(value, skill, key, diagnostics) {
  if (!isRecord(value)) return invalid(skill, key, diagnostics);
  if (value.enabled === false) return undefined;
  if (value.enabled !== undefined && typeof value.enabled !== "boolean") return invalid(skill, key, diagnostics);
  const timeout = optionalTimeout(value.timeout, skill, key, diagnostics);
  if (timeout === undefined && value.timeout !== undefined) return undefined;
  if (value.type === "local") {
    const command = commandParts(value.command, skill, key, diagnostics);
    if (command === undefined) return undefined;
    const env = stringMap(value.environment, skill, key, "environment", diagnostics);
    if (env === undefined) return undefined;
    return { transport: "stdio", serverName: key, command: command[0], args: command.slice(1), env, toolCallTimeoutMs: timeout ?? 30_000, failOnStartupError: false };
  }
  if (value.type === "remote") {
    const url = typeof value.url === "string" && value.url.length <= MAX_VALUE_LENGTH ? parseStreamableUrl(value.url) : undefined;
    if (url === undefined) {
      diagnostics.push(diagnostic(skill, `MCP "${key}" requires a Streamable HTTP URL`));
      return undefined;
    }
    const headers = stringMap(value.headers, skill, key, "headers", diagnostics);
    if (headers === undefined) return undefined;
    return { transport: "streamable-http", serverName: key, url, headers, toolCallTimeoutMs: timeout ?? 30_000, failOnStartupError: false };
  }
  return invalid(skill, key, diagnostics);
}

function commandParts(value, skill, key, diagnostics) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_COMMAND_ARGS) return invalid(skill, key, diagnostics);
  const parts = [];
  for (const part of value) {
    if (typeof part !== "string" || part.length === 0 || part.length > MAX_VALUE_LENGTH || UNSAFE_COMMAND_CHARS.test(part)) return invalid(skill, key, diagnostics);
    parts.push(part);
  }
  if (parts[0].length > 500) return invalid(skill, key, diagnostics);
  return parts;
}

function stringMap(value, skill, key, field, diagnostics) {
  if (value === undefined) return {};
  if (!isRecord(value) || Object.keys(value).length > MAX_MAP_ENTRIES) return invalid(skill, key, diagnostics);
  const result = {};
  for (const [mapKey, mapValue] of Object.entries(value)) {
    if (typeof mapValue !== "string" || mapValue.length > MAX_VALUE_LENGTH || (field === "headers" && !/^[A-Za-z0-9-]+$/u.test(mapKey))) return invalid(skill, key, diagnostics);
    result[mapKey] = mapValue;
  }
  return result;
}

function optionalTimeout(value, skill, key, diagnostics) {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 100 || value > 300_000) {
    diagnostics.push(diagnostic(skill, `MCP "${key}" timeout is invalid`));
    return undefined;
  }
  return value;
}

function parseStreamableUrl(value) {
  try {
    const url = new URL(value);
    return url.pathname.toLowerCase().endsWith("/sse") ? undefined : url.toString();
  } catch {
    return undefined;
  }
}
function safeDirectories(path) {
  try { return readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^[a-z][a-z0-9-]*$/u.test(entry.name)).map((entry) => entry.name).sort(); }
  catch { return []; }
}
function invalid(skill, key, diagnostics) {
  diagnostics.push(diagnostic(skill, `MCP "${key}" declaration is invalid`));
  return undefined;
}
function diagnostic(skill, message) { return { sourcePath: `skill:${skill}`, message }; }
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
