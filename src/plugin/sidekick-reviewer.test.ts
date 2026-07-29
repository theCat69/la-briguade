import { describe, expect, it, vi } from "vitest";

import { createSidekickReviewerTool, findLatestSessionId } from "./sidekick-reviewer.js";

const abortController = new AbortController();

function createToolContext() {
  return {
    abort: abortController.signal,
    directory: "/project",
    metadata: vi.fn(),
    sessionID: "ses_main",
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
          { directory: "/project", id: "ses_latest", title: "ses_main_review", updated: 2 },
          { directory: "/project", id: "ses_old", title: "ses_main_review", updated: 1 },
        ]),
      })
      .mockResolvedValueOnce({ exitCode: 0, stderr: "", stdout: "No blocking issues." });
    const sidekickTool = createSidekickReviewerTool(commandRunner);
    const context = createToolContext();

    const result = await sidekickTool.execute(
      { new_session: false, review_prompt: "Review the current diff.", review_type: "CODE_REVIEW" },
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
        "ses_main_review",
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
    const sidekickTool = createSidekickReviewerTool(commandRunner, () => "ses_main_review_unrelated");
    const context = createToolContext();

    await sidekickTool.execute(
      { new_session: false, review_prompt: "Review the change.", review_type: "CODE_REVIEW" },
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
        "ses_main_review",
        "--",
        "Review the change.",
      ],
      { abort: abortController.signal, cwd: "/project", timeoutMs: 600_000 },
    );

    commandRunner.mockClear();
    commandRunner.mockResolvedValueOnce({ exitCode: 0, stderr: "", stdout: "Fresh review." });

    await sidekickTool.execute(
      { new_session: true, review_prompt: "Review another feature.", review_type: "CODE_REVIEW" },
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
        "ses_main_review_unrelated",
        "--",
        "Review another feature.",
      ],
      { abort: abortController.signal, cwd: "/project", timeoutMs: 600_000 },
    );
  });

  it("should resume an unrelated review session after it starts", async () => {
    const commandRunner = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 0, stderr: "", stdout: "Fresh review." })
      .mockResolvedValueOnce({
        exitCode: 0,
        stderr: "",
        stdout: JSON.stringify([
          {
            directory: "/project",
            id: "ses_unrelated",
            title: "ses_main_review_unrelated",
            updated: 1,
          },
          { directory: "/project", id: "ses_default", title: "ses_main_review", updated: 2 },
        ]),
      })
      .mockResolvedValueOnce({ exitCode: 0, stderr: "", stdout: "Follow-up review." });
    const sidekickTool = createSidekickReviewerTool(commandRunner, () => "ses_main_review_unrelated");
    const context = createToolContext();

    await sidekickTool.execute(
      { new_session: true, review_prompt: "Review another feature.", review_type: "CODE_REVIEW" },
      context as never,
    );
    await sidekickTool.execute(
      { new_session: false, review_prompt: "Review its follow-up.", review_type: "CODE_REVIEW" },
      context as never,
    );

    expect(commandRunner).toHaveBeenNthCalledWith(
      3,
      "opencode",
      [
        "run",
        "--session",
        "ses_unrelated",
        "--agent",
        "sidekick-reviewer",
        "--title",
        "ses_main_review_unrelated",
        "--",
        "Review its follow-up.",
      ],
      { abort: abortController.signal, cwd: "/project", timeoutMs: 600_000 },
    );
  });

  it("should isolate sessions and agents by review type", async () => {
    const commandRunner = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stderr: "",
        stdout: JSON.stringify([
          { directory: "/project", id: "ses_security", title: "ses_main_sec-review", updated: 1 },
        ]),
      })
      .mockResolvedValueOnce({ exitCode: 0, stderr: "", stdout: "No vulnerabilities." })
      .mockResolvedValueOnce({
        exitCode: 0,
        stderr: "",
        stdout: JSON.stringify([
          { directory: "/project", id: "ses_docs", title: "ses_main_doc-review", updated: 1 },
        ]),
      })
      .mockResolvedValueOnce({ exitCode: 0, stderr: "", stdout: "Documentation is current." });
    const sidekickTool = createSidekickReviewerTool(commandRunner);
    const context = createToolContext();

    await sidekickTool.execute(
      {
        new_session: false,
        review_prompt: "Review the security impact.",
        review_type: "SECURITY_REVIEW",
      },
      context as never,
    );
    await sidekickTool.execute(
      {
        new_session: false,
        review_prompt: "Review the documentation impact.",
        review_type: "DOCUMENTATION_REVIEW",
      },
      context as never,
    );

    expect(commandRunner).toHaveBeenNthCalledWith(
      2,
      "opencode",
      [
        "run",
        "--session",
        "ses_security",
        "--agent",
        "sidekick-security-reviewer",
        "--title",
        "ses_main_sec-review",
        "--",
        "Review the security impact.",
      ],
      { abort: abortController.signal, cwd: "/project", timeoutMs: 600_000 },
    );
    expect(commandRunner).toHaveBeenNthCalledWith(
      4,
      "opencode",
      [
        "run",
        "--session",
        "ses_docs",
        "--agent",
        "sidekick-librarian",
        "--title",
        "ses_main_doc-review",
        "--",
        "Review the documentation impact.",
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
        { new_session: false, review_prompt: "Review the change.", review_type: "CODE_REVIEW" },
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
        { new_session: true, review_prompt: "Review the change.", review_type: "CODE_REVIEW" },
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
        { new_session: true, review_prompt: "Review the change.", review_type: "CODE_REVIEW" },
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
        { new_session: true, review_prompt: "Review the change.", review_type: "CODE_REVIEW" },
        { ...createToolContext(), abort: cancelledRequest.signal } as never,
      ),
    ).rejects.toThrow("Sidekick review was cancelled.");
    expect(commandRunner).toHaveBeenCalledOnce();
  });
});
