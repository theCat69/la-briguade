const ENV_TOKEN = /\{env:([^}]+)\}/gu;
const UNSAFE_COMMAND_CHARS = /[;|&$`<>!]/u;

/** Convert explicit, DSH-specific MCP configuration to the native client's schema. */
export function resolveMcpServers(configured = {}, environment = process.env, diagnostics = []) {
  const resolved = [];
  const names = new Set();
  for (const [key, server] of Object.entries(configured)) {
    if (names.has(server.serverName)) {
      diagnostics.push({ sourcePath: key, message: "duplicate MCP server namespace" });
      continue;
    }
    names.add(server.serverName);
    const mapped = mapServer(key, server, environment, diagnostics);
    if (mapped !== undefined) resolved.push(mapped);
  }
  return resolved;
}

function mapServer(key, server, environment, diagnostics) {
  if (server.transport === "stdio") {
    const command = resolveTokens(server.command, environment, diagnostics, key, "command");
    const args = (server.args ?? []).map((value) => resolveTokens(value, environment, diagnostics, key, "command"));
    if (command === "" || args.some((value) => value === "" || UNSAFE_COMMAND_CHARS.test(value))) {
      diagnostics.push({ sourcePath: key, message: "MCP stdio command contains an unsafe or missing value" });
      return undefined;
    }
    return {
      transport: "stdio", serverName: server.serverName, command, args,
      env: resolveEnvironment(server.env ?? {}, environment, diagnostics, key), cwd: server.cwd ?? process.cwd(),
      toolCallTimeoutMs: server.toolCallTimeoutMs ?? 30_000, failOnStartupError: server.failOnStartupError ?? false,
    };
  }
  const url = resolveTokens(server.url, environment, diagnostics, key, "url");
  try { new URL(url); } catch { diagnostics.push({ sourcePath: key, message: "MCP URL is invalid" }); return undefined; }
  return {
    transport: "streamable-http", serverName: server.serverName, url,
    headers: resolveHeaders(server.headers ?? {}, environment, diagnostics, key),
    toolCallTimeoutMs: server.toolCallTimeoutMs ?? 30_000, failOnStartupError: server.failOnStartupError ?? false,
  };
}

function resolveEnvironment(values, environment, diagnostics, sourcePath) {
  const result = {};
  for (const [key, value] of Object.entries(values)) {
    const resolved = resolveTokens(value, environment, diagnostics, sourcePath, "environment");
    if (resolved !== "") result[key] = resolved;
  }
  return result;
}
function resolveHeaders(values, environment, diagnostics, sourcePath) {
  const result = {};
  for (const [key, value] of Object.entries(values)) {
    if (!/^[A-Za-z0-9-]+$/u.test(key)) { diagnostics.push({ sourcePath, message: "MCP header name is invalid" }); continue; }
    result[key] = resolveTokens(value, environment, diagnostics, sourcePath, "header");
  }
  return result;
}
function resolveTokens(value, environment, diagnostics, sourcePath, field) {
  if (typeof value !== "string") return "";
  return value.replace(ENV_TOKEN, (_match, name) => {
    const resolved = environment[String(name).trim()];
    if (typeof resolved === "string") return resolved;
    diagnostics.push({ sourcePath, message: `MCP ${field} references an unavailable environment variable` });
    return "";
  });
}
