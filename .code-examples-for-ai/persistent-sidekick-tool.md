<!-- Pattern: persistent-sidekick-tool — A bounded custom tool that resumes an isolated caller-session review type safely. -->

```typescript
import { randomUUID } from "node:crypto";

import { tool } from "@opencode-ai/plugin";

const MAX_OUTPUT_LENGTH = 1_000_000;
const REVIEW_TYPES = {
  CODE_REVIEW: { agent: "sidekick-reviewer", suffix: "_review" },
  SECURITY_REVIEW: { agent: "sidekick-security-reviewer", suffix: "_sec-review" },
  DOCUMENTATION_SYNC: { agent: "sidekick-librarian", suffix: "_doc-sync" },
} as const;

export function createSidekickAgentTool(runCommand: CommandRunner) {
  const reviewSessionNames = new Map<string, string>();

  return tool({
    description: "Request a persistent code or security review, or synchronize documentation.",
    args: {
      review_prompt: tool.schema.string().trim().min(1).max(20_000),
      review_type: tool.schema.enum(["CODE_REVIEW", "SECURITY_REVIEW", "DOCUMENTATION_SYNC"]),
      new_session: tool.schema.boolean().default(false),
    },
    async execute(args, context) {
      const reviewType = REVIEW_TYPES[args.review_type];
      // Run DOCUMENTATION_SYNC only after review findings are resolved; its agent can edit only
      // approved Markdown documentation, prompts, skills, and code examples.
      const sessionKey = `${context.sessionID}:${args.review_type}`;
      const reviewSessionName = args.new_session
        ? `${context.sessionID}${reviewType.suffix}_${randomUUID().slice(0, 8)}`
        : reviewSessionNames.get(sessionKey) ?? `${context.sessionID}${reviewType.suffix}`;
      reviewSessionNames.set(sessionKey, reviewSessionName);
      // Use JSON, exact title matching, the active project directory, and updated timestamps.
      const sessionId = args.new_session
        ? undefined
        : await findLatestSessionId(runCommand, reviewSessionName, context.directory);

      // `--` keeps user-provided review text from being parsed as CLI options.
      const commandArgs = sessionId === undefined
        ? ["run", "--agent", reviewType.agent, "--title", reviewSessionName, "--", args.review_prompt]
        : ["run", "--session", sessionId, "--agent", reviewType.agent, "--title", reviewSessionName, "--", args.review_prompt];
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
