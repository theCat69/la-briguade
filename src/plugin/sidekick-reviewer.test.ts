import { describe, expect, it, vi } from "vitest";

import { createSidekickReviewerTool, findLatestSessionId } from "./sidekick-reviewer.js";

const abortController = new AbortController();

function createToolContext() {
  return {
    abort: abortController.signal,
    directory: "/project",
    metadata: vi.fn(),
  };
}

describe("findLatestSessionId", () => {
  it("should return the first exact title match from the session list", () => {
    const sessions = JSON.stringify([
      { directory: "/project", id: "ses_older", title: "review-task-x", updated: 1 },
      { directory: "/project", id: "ses_newest", title: "review-task-x", updated: 2 },
      { directory: "/other", id: "ses_other", title: "review-task-x", updated: 3 },
    ]);

    expect(findLatestSessionId(sessions, "review-task-x", "/project")).toBe("ses_newest");
  });

  it("should reject malformed session data", () => {
    const sessions = "not JSON";

    expect(() => findLatestSessionId(sessions, "review-task-x", "/project")).toThrow(
      "OpenCode returned an invalid JSON session list.",
    );
  });
});

describe("sidekick-reviewer tool", () => {
  it("should resume the newest matching session", async () => {
    const commandRunner = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stderr: "",
        stdout: JSON.stringify([
          { directory: "/project", id: "ses_latest", title: "feature-auth", updated: 2 },
          { directory: "/project", id: "ses_old", title: "feature-auth", updated: 1 },
        ]),
      })
      .mockResolvedValueOnce({ exitCode: 0, stderr: "", stdout: "No blocking issues." });
    const sidekickTool = createSidekickReviewerTool(commandRunner);
    const context = createToolContext();

    const result = await sidekickTool.execute(
      { new_session: false, review_prompt: "Review the current diff.", session_name: "feature-auth" },
      context as never,
    );

    expect(commandRunner).toHaveBeenNthCalledWith(
      1,
      "opencode",
      ["session", "list", "--format", "json", "--max-count", "100"],
      { abort: abortController.signal, cwd: "/project", timeoutMs: 10_000 },
    );
    expect(commandRunner).toHaveBeenNthCalledWith(
      2,
      "opencode",
      [
        "run",
        "--session",
        "ses_latest",
        "--agent",
        "sidekick-reviewer",
        "--title",
        "feature-auth",
        "--",
        "Review the current diff.",
      ],
      { abort: abortController.signal, cwd: "/project", timeoutMs: 600_000 },
    );
    expect(result).toMatchObject({ output: "No blocking issues." });
    expect(context.metadata).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ sessionId: "ses_latest" }) }),
    );
  });

  it("should start a new session when none exists or one is requested", async () => {
    const commandRunner = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 0, stderr: "", stdout: "[]" })
      .mockResolvedValueOnce({ exitCode: 0, stderr: "", stdout: "Review complete." });
    const sidekickTool = createSidekickReviewerTool(commandRunner);
    const context = createToolContext();

    await sidekickTool.execute(
      { new_session: false, review_prompt: "Review the change.", session_name: "feature-auth" },
      context as never,
    );

    expect(commandRunner).toHaveBeenNthCalledWith(
      2,
      "opencode",
      [
        "run",
        "--agent",
        "sidekick-reviewer",
        "--title",
        "feature-auth",
        "--",
        "Review the change.",
      ],
      { abort: abortController.signal, cwd: "/project", timeoutMs: 600_000 },
    );

    commandRunner.mockClear();
    commandRunner.mockResolvedValueOnce({ exitCode: 0, stderr: "", stdout: "Fresh review." });

    await sidekickTool.execute(
      { new_session: true, review_prompt: "Review another feature.", session_name: "feature-api" },
      context as never,
    );

    expect(commandRunner).toHaveBeenCalledOnce();
    expect(commandRunner).toHaveBeenCalledWith(
      "opencode",
      [
        "run",
        "--agent",
        "sidekick-reviewer",
        "--title",
        "feature-api",
        "--",
        "Review another feature.",
      ],
      { abort: abortController.signal, cwd: "/project", timeoutMs: 600_000 },
    );
  });

  it("should return an actionable error when session lookup fails", async () => {
    const commandRunner = vi.fn().mockResolvedValue({
      exitCode: 1,
      stderr: "opencode: command not found",
      stdout: "",
    });
    const sidekickTool = createSidekickReviewerTool(commandRunner);

    await expect(
      sidekickTool.execute(
        { new_session: false, review_prompt: "Review the change.", session_name: "feature-auth" },
        createToolContext() as never,
      ),
    ).rejects.toThrow("Sidekick review failed while listing sessions (exit 1)");
  });

  it("should return an actionable error when the reviewer exits non-zero", async () => {
    const commandRunner = vi.fn().mockResolvedValue({
      exitCode: 2,
      stderr: "sidekick agent is unavailable",
      stdout: "",
    });
    const sidekickTool = createSidekickReviewerTool(commandRunner);

    await expect(
      sidekickTool.execute(
        { new_session: true, review_prompt: "Review the change.", session_name: "feature-auth" },
        createToolContext() as never,
      ),
    ).rejects.toThrow("Sidekick review failed while starting a session (exit 2)");
  });

  it("should report cancellation even when the child process exits successfully", async () => {
    const cancelledRequest = new AbortController();
    cancelledRequest.abort();
    const commandRunner = vi.fn();
    const sidekickTool = createSidekickReviewerTool(commandRunner);

    await expect(
      sidekickTool.execute(
        { new_session: true, review_prompt: "Review the change.", session_name: "feature-auth" },
        { ...createToolContext(), abort: cancelledRequest.signal } as never,
      ),
    ).rejects.toThrow("Sidekick review was cancelled.");
    expect(commandRunner).not.toHaveBeenCalled();
  });

  it("should report cancellation when an in-flight child exits successfully", async () => {
    const cancelledRequest = new AbortController();
    const commandRunner = vi.fn(async () => {
      cancelledRequest.abort();
      return { exitCode: 0, stderr: "", stdout: "Review complete." };
    });
    const sidekickTool = createSidekickReviewerTool(commandRunner);

    await expect(
      sidekickTool.execute(
        { new_session: true, review_prompt: "Review the change.", session_name: "feature-auth" },
        { ...createToolContext(), abort: cancelledRequest.signal } as never,
      ),
    ).rejects.toThrow("Sidekick review was cancelled.");
    expect(commandRunner).toHaveBeenCalledOnce();
  });
});
