import { spawn } from "node:child_process";

import { tool } from "@opencode-ai/plugin";
import type { ToolDefinition } from "@opencode-ai/plugin";

const SIDEKICK_AGENT = "sidekick-reviewer";
const MAX_CLI_OUTPUT_LENGTH = 1_000_000;
const FORCE_KILL_GRACE_MS = 5_000;
const REVIEW_TIMEOUT_MS = 600_000;
const SESSION_LIST_MAX_COUNT = 100;
const SESSION_LIST_TIMEOUT_MS = 10_000;
const SESSION_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._ -]*$/;

interface CommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

interface CommandOptions {
  abort: AbortSignal;
  cwd: string;
  timeoutMs: number;
}

type CommandRunner = (
  command: string,
  args: string[],
  options: CommandOptions,
) => Promise<CommandResult>;

interface SidekickReviewArgs {
  new_session: boolean;
  review_prompt: string;
  session_name: string;
}

interface SessionSummary {
  directory: string;
  id: string;
  title: string;
  updated: number;
}

function isSessionSummary(value: unknown): value is SessionSummary {
  return (
    value !== null &&
    typeof value === "object" &&
    "id" in value &&
    "title" in value &&
    "directory" in value &&
    "updated" in value &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.directory === "string" &&
    typeof value.updated === "number"
  );
}

/** Returns the newest exact-title session in the active project from OpenCode's JSON session list. */
export function findLatestSessionId(
  sessionList: string,
  sessionName: string,
  directory: string,
): string | undefined {
  let parsed: unknown;

  try {
    parsed = JSON.parse(sessionList);
  } catch {
    throw new Error("OpenCode returned an invalid JSON session list.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("OpenCode returned a session list with an unexpected format.");
  }

  const matchingSessions = parsed.filter(
    (session): session is SessionSummary =>
      isSessionSummary(session) && session.title === sessionName && session.directory === directory,
  );
  const latestSession = matchingSessions.reduce<SessionSummary | undefined>(
    (latest, session) => (latest === undefined || session.updated > latest.updated ? session : latest),
    undefined,
  );

  return latestSession?.id;
}

function runCommand(command: string, args: string[], options: CommandOptions): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      signal: options.abort,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let outputLimitExceeded = false;
    let timedOut = false;
    let outputLength = 0;
    let forceKillTimeout: ReturnType<typeof setTimeout> | undefined;
    const scheduleForceKill = () => {
      if (forceKillTimeout !== undefined) return;

      forceKillTimeout = setTimeout(() => {
        child.kill("SIGKILL");
      }, FORCE_KILL_GRACE_MS);
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
      scheduleForceKill();
    }, options.timeoutMs);
    const handleAbort = () => {
      child.kill();
      scheduleForceKill();
    };
    options.abort.addEventListener("abort", handleAbort, { once: true });

    const appendOutput = (current: string, chunk: Buffer): string => {
      if (outputLimitExceeded) return current;

      const output = chunk.toString();
      const remainingLength = MAX_CLI_OUTPUT_LENGTH - outputLength;
      if (output.length <= remainingLength) {
        outputLength += output.length;
        return current + output;
      }

      outputLimitExceeded = true;
      child.kill();
      scheduleForceKill();
      return current + output.slice(0, Math.max(remainingLength, 0));
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendOutput(stdout, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendOutput(stderr, chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      if (!options.abort.aborted && forceKillTimeout !== undefined) clearTimeout(forceKillTimeout);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      if (forceKillTimeout !== undefined) clearTimeout(forceKillTimeout);
      options.abort.removeEventListener("abort", handleAbort);
      resolve({
        exitCode: outputLimitExceeded || timedOut ? 1 : (exitCode ?? 1),
        stderr: outputLimitExceeded
          ? "OpenCode output exceeded 1,000,000 characters."
          : timedOut
            ? `OpenCode timed out after ${options.timeoutMs} ms.`
            : stderr,
        stdout,
      });
    });
  });
}

function formatCommandError(action: string, result: CommandResult): string {
  const detail = result.stderr.trim() || result.stdout.trim() || "no diagnostic output";
  return `Sidekick review failed while ${action} (exit ${result.exitCode}): ${detail}`;
}

function formatUnexpectedError(error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`Sidekick review failed: ${detail}`);
}

function throwIfAborted(abort: AbortSignal): void {
  if (abort.aborted) {
    throw new Error("Sidekick review was cancelled.");
  }
}

async function resolveSessionId(
  sessionName: string,
  options: CommandOptions,
  commandRunner: CommandRunner,
): Promise<string | undefined> {
  const result = await commandRunner(
    "opencode",
    ["session", "list", "--format", "json", "--max-count", String(SESSION_LIST_MAX_COUNT)],
    { ...options, timeoutMs: SESSION_LIST_TIMEOUT_MS },
  );
  if (result.exitCode !== 0) {
    throw new Error(formatCommandError("listing sessions", result));
  }

  return findLatestSessionId(result.stdout, sessionName, options.cwd);
}

function buildRunArgs(args: SidekickReviewArgs, sessionId: string | undefined): string[] {
  const commonArgs = [
    "--agent",
    SIDEKICK_AGENT,
    "--title",
    args.session_name,
    "--",
    args.review_prompt,
  ];

  return sessionId === undefined
    ? ["run", ...commonArgs]
    : ["run", "--session", sessionId, ...commonArgs];
}

/** Creates the tool used to run persistent sidekick review sessions. */
export function createSidekickReviewerTool(
  commandRunner: CommandRunner = runCommand,
): ToolDefinition {
  return tool({
    description:
      "Request a persistent code-quality review from sidekick-reviewer. Reuse a session only for " +
      "the same feature or code area; set new_session for unrelated work or a fresh review.",
    args: {
      session_name: tool.schema
        .string()
        .trim()
        .min(1)
        .max(120)
        .regex(SESSION_NAME_PATTERN, "session_name contains unsupported characters"),
      review_prompt: tool.schema.string().trim().min(1).max(20_000),
      new_session: tool.schema.boolean().default(false),
    },
    async execute(args, context) {
      try {
        throwIfAborted(context.abort);
        const commandOptions = {
          abort: context.abort,
          cwd: context.directory,
          timeoutMs: REVIEW_TIMEOUT_MS,
        };
        const sessionId = args.new_session
          ? undefined
          : await resolveSessionId(args.session_name, commandOptions, commandRunner);
        throwIfAborted(context.abort);
        const action = sessionId === undefined ? "starting a session" : "resuming a session";
        const result = await commandRunner(
          "opencode",
          buildRunArgs(args, sessionId),
          commandOptions,
        );
        throwIfAborted(context.abort);

        if (result.exitCode !== 0) {
          throw new Error(formatCommandError(action, result));
        }

        const metadata = {
          sessionName: args.session_name,
          sessionId,
          startedNewSession: sessionId === undefined,
        };
        context.metadata({ title: `Sidekick review: ${args.session_name}`, metadata });

        return {
          title: `Sidekick review: ${args.session_name}`,
          output: result.stdout.trim() || "Sidekick review completed without output.",
          metadata,
        };
      } catch (error) {
        throw formatUnexpectedError(error);
      }
    },
  });
}
