import { afterEach, describe, expect, it, vi } from "vitest";

import { createHooks } from "./index.js";
import { notifier } from "../utils/runtime/notifier.js";

import type { PluginInput } from "../types/plugin.js";

function createHooksFixture() {
  const hooks = createHooks({} as PluginInput);
  return {
    event: hooks.event,
    toolExecuteAfter: hooks["tool.execute.after"],
  };
}

function getToolExecuteAfterHook() {
  return createHooksFixture().toolExecuteAfter;
}

function getEventHook() {
  return createHooksFixture().event;
}

describe("tool.execute.after", () => {
  it("should append edit retry hint when edit error marker is present", async () => {
    const hook = getToolExecuteAfterHook();
    const output = { output: "Error: oldString not found in target content." };

    await hook?.({ tool: "edit" } as never, output as never);

    expect(output.output).toContain(
      "Hint: Re-read the file to get current content before retrying the edit.",
    );
  });

  it("should append edit retry hint for multiple oldString matches marker", async () => {
    const hook = getToolExecuteAfterHook();
    const output = {
      output: "Error: Found multiple matches for oldString in target content.",
    };

    await hook?.({ tool: "edit" } as never, output as never);

    expect(output.output).toContain(
      "Hint: Re-read the file to get current content before retrying the edit.",
    );
  });

});

describe("detectEmptyResponse via event hook", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should warn when assistant message completes with zero output tokens", async () => {
    const warnSpy = vi.spyOn(notifier, "warn").mockImplementation(() => undefined);
    const eventHook = getEventHook();

    await eventHook?.({
      event: {
        type: "message.updated",
        properties: {
          info: {
            role: "assistant",
            time: { completed: "2026-01-01T00:00:00.000Z" },
            tokens: { output: 0 },
          },
        },
      },
    } as never);

    expect(warnSpy).toHaveBeenCalledWith(
      "Empty assistant response detected — the model produced no output tokens.",
    );
  });

  it("should not warn when assistant output tokens are non-zero", async () => {
    const warnSpy = vi.spyOn(notifier, "warn").mockImplementation(() => undefined);
    const eventHook = getEventHook();

    await eventHook?.({
      event: {
        type: "message.updated",
        properties: {
          info: {
            role: "assistant",
            time: { completed: "2026-01-01T00:00:00.000Z" },
            tokens: { output: 5 },
          },
        },
      },
    } as never);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should not warn for non-message.updated event types", async () => {
    const warnSpy = vi.spyOn(notifier, "warn").mockImplementation(() => undefined);
    const eventHook = getEventHook();

    await eventHook?.({
      event: {
        type: "message.created",
        properties: {
          info: {
            role: "assistant",
            time: { completed: "2026-01-01T00:00:00.000Z" },
            tokens: { output: 0 },
          },
        },
      },
    } as never);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should not warn when event properties are missing", async () => {
    const warnSpy = vi.spyOn(notifier, "warn").mockImplementation(() => undefined);
    const eventHook = getEventHook();

    await eventHook?.({
      event: {
        type: "message.updated",
      },
    } as never);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should not warn when role is not assistant", async () => {
    const warnSpy = vi.spyOn(notifier, "warn").mockImplementation(() => undefined);
    const eventHook = getEventHook();

    await eventHook?.({
      event: {
        type: "message.updated",
        properties: {
          info: {
            role: "user",
            time: { completed: "2026-01-01T00:00:00.000Z" },
            tokens: { output: 0 },
          },
        },
      },
    } as never);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should not warn when completed time is missing", async () => {
    const warnSpy = vi.spyOn(notifier, "warn").mockImplementation(() => undefined);
    const eventHook = getEventHook();

    await eventHook?.({
      event: {
        type: "message.updated",
        properties: {
          info: {
            role: "assistant",
            time: {},
            tokens: { output: 0 },
          },
        },
      },
    } as never);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should not warn when tokens exists but has no output property", async () => {
    const warnSpy = vi.spyOn(notifier, "warn").mockImplementation(() => undefined);
    const eventHook = getEventHook();

    await eventHook?.({
      event: {
        type: "message.updated",
        properties: {
          info: {
            role: "assistant",
            time: { completed: "2026-01-01T00:00:00.000Z" },
            tokens: {},
          },
        },
      },
    } as never);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
