import z from "@deepseek-ai/schemastery";

const identifier = z.string().pattern(/^[a-z][a-z0-9-]*$/u);
const safePath = z.string().max(1_000);
const mcpServer = z.object({
  transport: z.string().pattern(/^(stdio|streamable-http)$/u),
  serverName: z.string().pattern(/^[A-Za-z0-9_-]{1,32}$/u),
  command: z.string().max(500),
  args: z.array(z.string().max(2_000)).max(50).default([]),
  env: z.dict(z.string().max(2_000)).max(50).default({}),
  cwd: safePath.default(process.cwd()),
  url: z.string().max(2_000),
  headers: z.dict(z.string().max(2_000)).max(50).default({}),
  toolCallTimeoutMs: z.number().min(100).max(300_000).default(30_000),
  failOnStartupError: z.boolean().default(false),
  personas: z.array(identifier).max(20).default([]),
});

export const Config = z.object({
  maxDelegationDepth: z.number().step(1).min(1).max(8).default(1),
  enabledWorkflows: z.array(identifier).max(17),
  enabledPersonas: z.array(identifier).max(20),
  contentRoots: z.array(safePath).max(4),
  autoInject: z.object({ enabled: z.boolean().default(true), maxDepth: z.number().step(1).min(0).max(8).default(1) }),
  modelPolicies: z.dict(z.object({ reasoningEffort: z.string().pattern(/^(low|medium|high)$/u) })),
  mcp: z.dict(mcpServer, z.string().pattern(/^[A-Za-z0-9_-]{1,32}$/u)).max(10),
});

export function resolveConfig(config = {}) {
  let resolved;
  try { resolved = Config(config); }
  catch (error) { throw new Error(`Invalid la-briguade DSH config: ${error instanceof Error ? error.message : String(error)}`); }
  for (const root of resolved.contentRoots ?? []) {
    if (root.includes("\0") || root.split(/[\\/]+/u).includes("..")) throw new Error("Invalid la-briguade DSH config: content root must not contain traversal.");
  }
  for (const server of Object.values(resolved.mcp ?? {})) {
    if (server.transport === "stdio" && (!server.command || server.url)) throw new Error("Invalid la-briguade DSH config: stdio MCP requires only command configuration.");
    if (server.transport === "streamable-http" && (!server.url || server.command)) throw new Error("Invalid la-briguade DSH config: streamable-http MCP requires only URL configuration.");
  }
  return resolved;
}
