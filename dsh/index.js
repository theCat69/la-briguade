import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import z from "@deepseek-ai/schemastery";
import { parse } from "yaml";
import { defineTool } from "@deepseek-ai/dsh-tools";

export const name = "la-briguade-dsh";
export const inject = ["agents", "skills", "subagents", "tools"];
export const Config = z.object({
  maxDelegationDepth: z.number().step(1).min(1).max(8).default(1),
});

const PRIMARY_PERSONAS = ["builder", "orchestrator", "planner", "ask"];
const SPECIALIST_PERSONAS = ["coder"];
const DEFAULT_CONTENT_DIR = new URL("./content/", import.meta.url).pathname;
const MAX_SKILL_LENGTH = 50_000;
const MAX_DELEGATION_DEPTH = 8;

/**
 * Install la-briguade's DSH-native skill catalog and delegation tools.
 *
 * Personas are configured as DSH agent presets in `cordis.patch.yml`; their
 * generated prompt files are rebuilt from the canonical OpenCode agent Markdown
 * by `scripts/prepare.mjs` before this package is packed or installed from Git.
 *
 * @param {import("@deepseek-ai/cordis").Context} ctx DSH plugin context.
 * @param {{ maxDelegationDepth?: number }} [config] Adapter configuration.
 * @returns {() => void} A disposer for all registered skills and tools.
 */
export function apply(ctx, config = {}) {
  const contentDir = DEFAULT_CONTENT_DIR;
  const maxDelegationDepth = resolveMaxDelegationDepth(config.maxDelegationDepth);
  const disposers = registerSkills(ctx, contentDir);

  disposers.push(
    ctx.tools.register(createPersonasTool()),
    ctx.tools.register(createDelegateTool(ctx, maxDelegationDepth)),
  );

  return () => {
    for (const dispose of disposers.reverse()) dispose();
  };
}

function createPersonasTool() {
  return defineTool({
    name: "la_briguade_personas",
    description: "List the la-briguade DSH personas and their intended roles.",
    parameters: {},
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          primary: { type: "array", items: { type: "string" }, required: true },
          specialists: { type: "array", items: { type: "string" }, required: true },
        },
      },
      render: (_args, value) => [{
        type: "text",
        text: `Primary personas: ${value.primary.join(", ")}. ` +
          `Delegation specialists: ${value.specialists.join(", ")}.`,
      }],
    },
    async execute() {
      return { primary: PRIMARY_PERSONAS, specialists: SPECIALIST_PERSONAS };
    },
  });
}

function createDelegateTool(ctx, maxDelegationDepth) {
  return defineTool({
    name: "la_briguade_delegate",
    description: "Delegate a self-contained implementation task to a la-briguade specialist.",
    parameters: {
      persona: { type: "string", required: true, description: "Specialist persona; currently coder." },
      task: { type: "string", required: true, description: "Standalone task for the specialist." },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          persona: { type: "string", required: true },
          result: { type: "string", required: true },
        },
      },
      render: (_args, value) => [{ type: "text", text: value.result }],
    },
    async execute({ persona, task }, exec) {
      if (!SPECIALIST_PERSONAS.includes(persona)) {
        throw new Error(`Unsupported la-briguade specialist: ${JSON.stringify(persona)}`);
      }
      if (task.trim().length === 0 || task.length > 20_000) {
        throw new Error("Delegation task must contain between 1 and 20,000 characters.");
      }

      const parent = ctx.agents.currentInitiator();
      if (parent === undefined) {
        throw new Error("la_briguade_delegate must run from an active DSH agent.");
      }

      const run = await ctx.subagents.start("spawn", {
        label: `la-briguade-${persona}`,
        prompt: [{ type: "text", text: task }],
        parent,
        signal: exec.signal,
        maxDepth: maxDelegationDepth,
        persona: coderPersonaPrompt(),
        toolFilter: {
          allow: ["read", "write", "edit", "grep", "glob", "bash", "skill"],
        },
      });

      try {
        const outcome = await run.result;
        if (outcome.stopReason !== "completed" || typeof outcome.output !== "string") {
          throw new Error(`Specialist stopped with reason: ${outcome.stopReason}`);
        }
        return { persona, result: outcome.output };
      } finally {
        await run.dispose();
      }
    },
  });
}

function registerSkills(ctx, contentDir) {
  const skillsDir = join(contentDir, "skills");
  const disposers = [];

  for (const directory of safeDirectories(skillsDir)) {
    const filePath = join(skillsDir, directory, "SKILL.md");
    const raw = readBoundedFile(filePath);
    if (raw === undefined) continue;

    const skill = parseSkill(raw, filePath);
    if (skill === undefined) continue;
    disposers.push(ctx.skills.register({ ...skill, source: "bundled" }));
  }

  const workflowPath = join(contentDir, "workflows", "just-do-it", "SKILL.md");
  const workflowRaw = readBoundedFile(workflowPath);
  if (workflowRaw !== undefined) {
    const workflow = parseSkill(workflowRaw, workflowPath);
    if (workflow !== undefined) disposers.push(ctx.skills.register({ ...workflow, source: "bundled" }));
  }

  return disposers;
}

function parseSkill(raw, filePath) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(raw);
  if (match === null) {
    console.warn(`la-briguade-dsh: skipping ${filePath}: missing YAML frontmatter`);
    return undefined;
  }

  let attributes;
  try {
    attributes = parse(match[1]);
  } catch (error) {
    console.warn(`la-briguade-dsh: skipping ${filePath}: invalid YAML (${errorMessage(error)})`);
    return undefined;
  }

  if (!isRecord(attributes) || !isSkillName(attributes.name) || typeof attributes.description !== "string") {
    console.warn(`la-briguade-dsh: skipping ${filePath}: name and description are required`);
    return undefined;
  }

  return {
    name: attributes.name,
    description: attributes.description,
    content: match[2],
    invocation: {
      modelInvocable: attributes["disable-model-invocation"] !== true,
      userInvocable: attributes["user-invocable"] !== false,
    },
    resourceBase: new URL(".", `file://${filePath}`).pathname,
  };
}

function safeDirectories(path) {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && isSkillName(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    console.warn(`la-briguade-dsh: cannot read skill directory ${path}: ${errorMessage(error)}`);
    return [];
  }
}

function readBoundedFile(path) {
  try {
    const content = readFileSync(path, "utf8");
    if (content.length > MAX_SKILL_LENGTH) {
      console.warn(`la-briguade-dsh: skipping ${path}: exceeds ${MAX_SKILL_LENGTH} characters`);
      return undefined;
    }
    return content;
  } catch (error) {
    console.warn(`la-briguade-dsh: cannot read ${path}: ${errorMessage(error)}`);
    return undefined;
  }
}

function resolveMaxDelegationDepth(value) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_DELEGATION_DEPTH) return 1;
  return value;
}

function coderPersonaPrompt() {
  return "You are la-briguade's coder specialist. Implement the self-contained task carefully, " +
    "validate changes when possible, and return a concise final result. Do not delegate further.";
}

function isSkillName(value) {
  return typeof value === "string" && /^[a-z][a-z0-9-]*$/u.test(value);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
