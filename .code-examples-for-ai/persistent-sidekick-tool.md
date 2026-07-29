<!-- Pattern: persistent-sidekick-tool — A bounded custom tool that resumes a title-scoped CLI session safely. -->

```typescript
import { tool } from "@opencode-ai/plugin";

const MAX_OUTPUT_LENGTH = 1_000_000;

export function createSidekickReviewerTool(runCommand: CommandRunner) {
  return tool({
    description: "Request a persistent, read-only code review.",
    args: {
      session_name: tool.schema.string().trim().min(1).max(120),
      review_prompt: tool.schema.string().trim().min(1).max(20_000),
      new_session: tool.schema.boolean().default(false),
    },
    async execute(args, context) {
      // Use JSON, exact title matching, the active project directory, and updated timestamps.
      const sessionId = args.new_session
        ? undefined
        : await findLatestSessionId(runCommand, args.session_name, context.directory);

      // `--` keeps user-provided review text from being parsed as CLI options.
      const commandArgs = sessionId === undefined
        ? ["run", "--agent", "sidekick-reviewer", "--title", args.session_name, "--", args.review_prompt]
        : ["run", "--session", sessionId, "--agent", "sidekick-reviewer", "--title", args.session_name, "--", args.review_prompt];
      const output = await runBoundedCommand(runCommand, commandArgs, {
        abort: context.abort,
        maxOutputLength: MAX_OUTPUT_LENGTH,
        timeoutMs: 600_000,
      });

      if (context.abort.aborted) throw new Error("Sidekick review was cancelled.");
      return output;
    },
  });
}
```
