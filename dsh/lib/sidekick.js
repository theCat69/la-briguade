import { boundedOutput, childToolInstruction } from "./delegation.js";

const MODES = new Map([
  ["CODE_REVIEW", "sidekick-reviewer"],
  ["SECURITY_REVIEW", "sidekick-security-reviewer"],
  ["DOCUMENTATION_SYNC", "sidekick-librarian"],
]);

/** Durable child ids are returned by DSH; this index only avoids an unnecessary list query while live. */
export function createSidekickManager(ctx, maxDepth, autoInject) {
  const children = new Map();
  return {
    async run(input, exec) {
      const { mode, task, new_session: newSession = false } = input ?? {};
      if (!MODES.has(mode)) throw new Error("Unsupported sidekick review mode.");
      if (typeof task !== "string" || task.trim().length === 0 || task.length > 20_000) {
        throw new Error("Sidekick task must contain between 1 and 20,000 characters.");
      }
      const parent = ctx.agents.currentInitiator();
      if (parent === undefined) throw new Error("la_briguade_sidekick must run from an active DSH agent.");
      const parentId = parent.session?.id ?? parent.id;
      if (typeof parentId !== "string") throw new Error("The active DSH agent has no durable session identity.");
      const key = `${parentId}:${mode}`;
      const existing = !newSession ? children.get(key) : undefined;
      if (existing !== undefined) {
        await ctx.subagents.sendMessage(parent, existing, [{ type: "text", text: task.trim() }], { signal: exec.signal });
        return { mode, childId: existing, resumed: true, result: "Sidekick task accepted by the existing continuable child." };
      }
      const started = await ctx.subagents.startContinuable({
        provider: "spawn",
        label: `la-briguade-${mode.toLowerCase()}`,
        request: {
          prompt: [{ type: "text", text: task.trim() }], parent, maxDepth,
          // Core DSH Web tools belong to the inherited preset scope, so they
          // cannot be named in native global-only `toolFilter` restrictions.
          persona: `You are la-briguade's ${MODES.get(mode)}. ${mode === "DOCUMENTATION_SYNC" ? "Only edit Markdown, text, AsciiDoc, prompts, and code examples; never edit source, manifests, schemas, generated files, or assets." : "Review only; do not mutate files."}\n\n${childToolInstruction(MODES.get(mode))}`,
        },
        signal: exec.signal,
      });
      children.set(key, started.childId);
      autoInject?.setPersona(started.childId, MODES.get(mode));
      return { mode, childId: started.childId, resumed: false, result: "Sidekick continuable child started and accepted the task." };
    },
    interrupt(parent, childId) { ctx.subagents.interrupt(childId, { kind: "ancestor", agent: parent }); },
    async dispose(parent) {
      const ids = [...children.entries()].filter(([key]) => key.startsWith(`${parent.session?.id ?? parent.id}:`)).map(([, id]) => id);
      if (ids.length > 0) await ctx.subagents.drainContinuableChildren(parent, ids);
    },
    format(result) { return boundedOutput(result, 4_000); },
  };
}
