export const PRIMARY_PERSONAS = ["builder", "orchestrator", "planner", "ask"];
export const SPECIALIST_PERSONAS = [
  "coder", "architect", "critic", "feature-designer", "feature-reviewer",
  "security-reviewer", "local-context-gatherer", "external-context-gatherer",
  "sidekick-reviewer", "sidekick-security-reviewer", "sidekick-librarian",
];

const READ_ONLY = ["read", "grep", "glob", "skill"];
export const TOOL_POLICIES = {
  coder: ["read", "write", "edit", "grep", "glob", "bash", "skill"],
  architect: READ_ONLY,
  critic: READ_ONLY,
  "feature-designer": READ_ONLY,
  "feature-reviewer": READ_ONLY,
  "security-reviewer": READ_ONLY,
  "local-context-gatherer": READ_ONLY,
  "external-context-gatherer": ["web_search", "web_fetch"],
  "sidekick-reviewer": READ_ONLY,
  "sidekick-security-reviewer": READ_ONLY,
  "sidekick-librarian": ["read", "write", "edit", "grep", "glob", "skill"],
};

export function validateDelegation(input, enabledPersonas) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Delegation request must be an object.");
  }
  const { persona, task, mode = "spawn" } = input;
  if (typeof persona !== "string" || !enabledPersonas.includes(persona) || !SPECIALIST_PERSONAS.includes(persona)) {
    throw new Error("Unsupported la-briguade specialist.");
  }
  if (typeof task !== "string" || task.trim().length === 0 || task.length > 20_000 || /\u0000/u.test(task)) {
    throw new Error("Delegation task must contain between 1 and 20,000 safe characters.");
  }
  if (mode !== "spawn" && mode !== "fork") throw new Error("Delegation mode must be spawn or fork.");
  return { persona, task: task.trim(), mode };
}

export function childPolicy(persona) {
  const tools = TOOL_POLICIES[persona];
  if (tools === undefined) throw new Error("No DSH tool policy exists for this specialist.");
  return { allow: [...tools] };
}

/**
 * DSH Web mounts core tools inside the selected agent-preset scope. Its native
 * `toolFilter` can restrict only globally registered tools, so passing the
 * canonical core-tool list would reject child creation before it starts.
 */
export function childToolInstruction(persona) {
  const { allow } = childPolicy(persona);
  return `Tool-use boundary: perform this role using only these tools when they are available: ${allow.join(", ")}. Do not use other tools. If the task requires another capability, explain the limitation to the parent instead.`;
}

export function boundedOutput(value, maximum = 20_000) {
  const text = typeof value === "string" ? value : "";
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum)}\n\n[la-briguade result truncated]`;
}
