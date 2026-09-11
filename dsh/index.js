import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { apply as applyMcpClient } from "@deepseek-ai/dsh-mcp-client";
import { defineTool } from "@deepseek-ai/dsh-tools";

import { Config, resolveConfig } from "./lib/config.js";
import { MAX_CONTENT_LENGTH, parseMarkdown } from "./lib/content.js";
import { boundedOutput, childPolicy, PRIMARY_PERSONAS, SPECIALIST_PERSONAS, validateDelegation } from "./lib/delegation.js";
import { installReliabilityHooks } from "./lib/hooks.js";
import { resolveMcpServers } from "./lib/mcp.js";
import { createSidekickManager } from "./lib/sidekick.js";

export const name = "la-briguade-dsh";
export const inject = ["agents", "skills", "subagents", "tools"];
export { Config };

const packageDir = dirname(fileURLToPath(import.meta.url));
const contentDir = join(packageDir, "content");

/** Install the native, least-privilege DSH adapter. */
export async function apply(ctx, input = {}) {
  const config = resolveConfig(input);
  const state = loadState(config);
  const disposers = registerSkills(ctx, state);
  const sidekick = createSidekickManager(ctx, config.maxDelegationDepth);
  disposers.push(
    ctx.tools.register(createPersonasTool(state)),
    ctx.tools.register(createDelegateTool(ctx, state, config.maxDelegationDepth)),
    ctx.tools.register(createSidekickTool(sidekick)),
    ctx.tools.register(createStatusTool(state, config)),
    ...installReliabilityHooks(ctx),
  );
  await mountMcp(ctx, config, state);
  return async () => {
    const parent = ctx.agents.currentInitiator();
    if (parent !== undefined) await sidekick.dispose(parent);
    for (const dispose of disposers.reverse()) dispose();
  };
}

function loadState(config) {
  const diagnostics = [];
  let manifest;
  try { manifest = JSON.parse(readFileSync(join(contentDir, "manifest.json"), "utf8")); }
  catch (error) { throw new Error(`la-briguade-dsh requires generated content; run npm run build:dsh (${errorMessage(error)})`); }
  const personaFilter = config.enabledPersonas?.length ? new Set(config.enabledPersonas) : undefined;
  const workflowFilter = config.enabledWorkflows?.length ? new Set(config.enabledWorkflows) : undefined;
  const enabledPersonas = (manifest.agents ?? []).filter((agent) => !personaFilter || personaFilter.has(agent.id));
  const enabledWorkflows = (manifest.workflows ?? []).filter((workflow) => !workflowFilter || workflowFilter.has(workflow.id));
  for (const agent of enabledPersonas) {
    try { agent.prompt = readBounded(join(contentDir, "personas", `${agent.id}.md`)); }
    catch { diagnostics.push({ sourcePath: agent.sourcePath, message: "persona prompt is unavailable" }); }
  }
  return { manifest, enabledPersonas, enabledWorkflows, diagnostics, config };
}

function registerSkills(ctx, state) {
  const disposers = [];
  for (const directory of safeDirectories(join(contentDir, "skills"))) registerSkillFile(ctx, join(contentDir, "skills", directory, "SKILL.md"), disposers, state);
  for (const workflow of state.enabledWorkflows) registerSkillFile(ctx, join(contentDir, "workflows", workflow.id, "SKILL.md"), disposers, state);
  return disposers;
}
function registerSkillFile(ctx, filePath, disposers, state) {
  try {
    const parsed = parseMarkdown(readBounded(filePath), filePath, state.diagnostics);
    if (parsed === undefined || typeof parsed.attributes.name !== "string" || typeof parsed.attributes.description !== "string") return;
    disposers.push(ctx.skills.register({ name: parsed.attributes.name, description: parsed.attributes.description, content: parsed.body, source: "bundled", invocation: { modelInvocable: parsed.attributes["disable-model-invocation"] !== true, userInvocable: parsed.attributes["user-invocable"] !== false }, resourceBase: dirname(filePath) }));
  } catch (error) { state.diagnostics.push({ sourcePath: filePath, message: `skill was not registered (${errorMessage(error)})` }); }
}

function createPersonasTool(state) {
  return defineTool({ name: "la_briguade_personas", description: "List enabled la-briguade DSH personas and their safe intended roles.", parameters: {}, output: outputSchema({ primary: { type: "array", items: { type: "string" }, required: true }, specialists: { type: "array", items: { type: "string" }, required: true } }, (value) => `Primary personas: ${value.primary.join(", ")}. Delegation specialists: ${value.specialists.join(", ")}.`), async execute() {
    const enabled = state.enabledPersonas.map((entry) => entry.id);
    return { primary: PRIMARY_PERSONAS.filter((id) => enabled.includes(id)), specialists: SPECIALIST_PERSONAS.filter((id) => enabled.includes(id)) };
  }});
}
function createDelegateTool(ctx, state, maxDepth) {
  return defineTool({ name: "la_briguade_delegate", description: "Delegate a self-contained task to a policy-scoped la-briguade specialist.", parameters: { persona: { type: "string", required: true }, task: { type: "string", required: true }, mode: { type: "string", required: true } }, output: outputSchema({ persona: { type: "string", required: true }, result: { type: "string", required: true }, stopReason: { type: "string", required: true } }, (value) => value.result), async execute(input, exec) {
    const request = validateDelegation(input, state.enabledPersonas.map((entry) => entry.id));
    const parent = ctx.agents.currentInitiator();
    if (parent === undefined) throw new Error("la_briguade_delegate must run from an active DSH agent.");
    const prompt = state.enabledPersonas.find((entry) => entry.id === request.persona)?.prompt;
    if (typeof prompt !== "string") throw new Error("The selected specialist prompt is unavailable.");
    const run = await ctx.subagents.start(request.mode, { label: `la-briguade-${request.persona}`, prompt: [{ type: "text", text: request.task }], parent, signal: exec.signal, maxDepth, persona: prompt, toolFilter: childPolicy(request.persona) });
    try { const outcome = await run.result; const result = boundedOutput(extractText(outcome.output)); return { persona: request.persona, result: outcome.stopReason === "completed" ? result : `${result}\n\nStopped: ${outcome.stopReason}`, stopReason: outcome.stopReason }; }
    finally { await run.dispose(); }
  }});
}
function createSidekickTool(sidekick) {
  return defineTool({ name: "la_briguade_sidekick", description: "Start or resume a persistent DSH-native review or documentation sidekick.", parameters: { mode: { type: "string", required: true }, task: { type: "string", required: true }, new_session: { type: "boolean", required: true } }, output: outputSchema({ mode: { type: "string", required: true }, childId: { type: "string", required: true }, resumed: { type: "boolean", required: true }, result: { type: "string", required: true } }, (value) => value.result), async execute(input, exec) { return sidekick.run(input, exec); }});
}
function createStatusTool(state, config) {
  return defineTool({ name: "la_briguade_status", description: "Report safe la-briguade DSH registration and compatibility diagnostics.", parameters: {}, output: outputSchema({ version: { type: "number", required: true }, personas: { type: "array", items: { type: "string" }, required: true }, workflows: { type: "array", items: { type: "string" }, required: true }, diagnostics: { type: "array", items: { type: "string" }, required: true } }, (value) => `la-briguade DSH: ${value.personas.length} personas, ${value.workflows.length} workflows.`), async execute() { return { version: state.manifest.version, personas: state.enabledPersonas.map((entry) => entry.id), workflows: state.enabledWorkflows.map((entry) => entry.name), diagnostics: state.diagnostics.map((entry) => `${entry.sourcePath}: ${entry.message}`).slice(0, 50), maxDelegationDepth: config.maxDelegationDepth }; }});
}
async function mountMcp(ctx, config, state) {
  const servers = resolveMcpServers(config.mcp, process.env, state.diagnostics);
  for (const server of servers) {
    try { await applyMcpClient(ctx, server); }
    catch (error) { state.diagnostics.push({ sourcePath: server.serverName, message: `MCP server unavailable (${errorMessage(error)})` }); }
  }
}
function outputSchema(properties, render) { return { schema: { type: "object", additionalProperties: false, properties }, render: (_args, value) => [{ type: "text", text: render(value) }] }; }
function safeDirectories(path) { try { return readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^[a-z][a-z0-9-]*$/u.test(entry.name)).map((entry) => entry.name).sort(); } catch { return []; } }
function readBounded(path) { const content = readFileSync(path, "utf8"); if (content.length > MAX_CONTENT_LENGTH) throw new Error("content exceeds size limit"); return content; }
function extractText(output) { return Array.isArray(output) ? output.filter((part) => part?.type === "text").map((part) => part.text ?? "").join("\n") : ""; }
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
