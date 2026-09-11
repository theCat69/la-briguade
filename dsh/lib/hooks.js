const EDIT_ERROR_PATTERNS = ["oldString not found", "Found multiple matches for oldString"];

export function isEditMismatch(toolName, result) {
  return toolName === "edit" && result?.isError === true && Array.isArray(result.content) && result.content.some(
    (block) => block?.type === "text" && EDIT_ERROR_PATTERNS.some((pattern) => String(block.text).includes(pattern)),
  );
}

/** Register DSH-native, result-preserving reliability interception. */
export function installReliabilityHooks(ctx, logger = console) {
  const disposers = [];
  if (typeof ctx?.on !== "function") return disposers;
  try {
    const dispose = ctx.on("tools/post-execute", async (exec, result, next) => {
      try {
        if (!isEditMismatch(exec.name, result)) return await next();
        return {
          kind: "accept",
          content: [...result.content, { type: "text", text: "Hint: Re-read the file to get current content before retrying the edit." }],
        };
      } catch (error) {
        logger.warn(`la-briguade-dsh: edit recovery hook failed: ${errorMessage(error)}`);
        return await next();
      }
    });
    if (typeof dispose === "function") disposers.push(dispose);
  } catch { logger.warn("la-briguade-dsh: tools/post-execute hook is unavailable in this profile"); }
  try {
    const dispose = ctx.on("agent/turn-stopping", (event) => {
      if (event?.output === "" || event?.outputTokens === 0) logger.warn("la-briguade-dsh: empty assistant response detected");
    });
    if (typeof dispose === "function") disposers.push(dispose);
  } catch { logger.warn("la-briguade-dsh: agent/turn-stopping hook is unavailable in this profile"); }
  return disposers;
}
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
