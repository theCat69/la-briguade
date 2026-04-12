import { afterEach, describe, expect, it, vi } from "vitest";

import { createHooks, type AgentSectionsEntry } from "./index.js";
import { notifier } from "../utils/notifier.js";
import { logger } from "../utils/logger.js";

import type { PluginInput } from "../types/plugin.js";

function getSystemTransformHook(
  agentSections: Map<string, AgentSectionsEntry>,
  vendorPrompts: Map<string, string>,
) {
  const hooks = createHooks(
    {} as PluginInput,
    agentSections,
    vendorPrompts,
    new Map<string, Record<string, string>>(),
  );
  return hooks["experimental.chat.system.transform"];
}

function getEventHook() {
  const hooks = createHooks(
    {} as PluginInput,
    new Map<string, AgentSectionsEntry>(),
    new Map<string, string>(),
    new Map<string, Record<string, string>>(),
  );
  return hooks.event;
}

function getToolExecuteAfterHook() {
  const hooks = createHooks(
    {} as PluginInput,
    new Map<string, AgentSectionsEntry>(),
    new Map<string, string>(),
    new Map<string, Record<string, string>>(),
  );
  return hooks["tool.execute.after"];
}

function getSkillHooks(agentSkillPerms: Map<string, Record<string, string>>) {
  const hooks = createHooks(
    {} as PluginInput,
    new Map<string, AgentSectionsEntry>(),
    new Map<string, string>(),
    agentSkillPerms,
  );

  return {
    chatParams: hooks["chat.params"],
    toolExecuteBefore: hooks["tool.execute.before"],
    event: hooks.event,
  };
}

describe("tool.execute.after", () => {
  it("should not throw when output.output is undefined", async () => {
    // Arrange
    const hook = getToolExecuteAfterHook();
    const output = {};
    const initialOutput = { ...output };

    // Act
    const execute = async () => hook?.({ tool: "bash" } as never, output as never);

    // Assert
    await expect(execute()).resolves.not.toThrow();
    expect(output).toEqual(initialOutput);
  });

  it("should truncate output above the max chars threshold", async () => {
    // Arrange
    const hook = getToolExecuteAfterHook();
    const largeOutput = "x".repeat(50_010);
    const output = { output: largeOutput };

    // Act
    await hook?.({ tool: "bash" } as never, output as never);

    // Assert
    expect(output.output).toContain("[truncated 15010 chars]");
  });

  it("should append edit retry hint when edit error marker is present", async () => {
    // Arrange
    const hook = getToolExecuteAfterHook();
    const output = { output: "Error: oldString not found in target content." };

    // Act
    await hook?.({ tool: "edit" } as never, output as never);

    // Assert
    expect(output.output).toContain(
      "Hint: Re-read the file to get current content before retrying the edit.",
    );
  });

  it("should truncate non-edit large output without appending edit hint", async () => {
    // Arrange
    const hook = getToolExecuteAfterHook();
    const output = { output: `oldString not found\n${"x".repeat(50_010)}` };

    // Act
    await hook?.({ tool: "bash" } as never, output as never);

    // Assert
    expect(output.output).toContain("[truncated");
    expect(output.output).not.toContain(
      "Hint: Re-read the file to get current content before retrying the edit.",
    );
  });
});

describe("injectVendorPrompts via experimental.chat.system.transform", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it(
    "should append vendor prompt to matched agent system string using lowercased family key",
    async () => {
    // Arrange
    const agentSections = new Map<string, AgentSectionsEntry>([
      ["coder", { base: "Base system prompt", segments: [] }],
    ]);
    const vendorPrompts = new Map<string, string>([["claude", "Global Claude prompt"]]);
    const transform = getSystemTransformHook(agentSections, vendorPrompts);

    const input = { model: { id: "Anthropic/Claude-3-7-sonnet" } };
    const output = { system: ["Base system prompt"] };

    // Act
    await transform?.(input as never, output as never);

    // Assert
    expect(output.system).toEqual(["Base system prompt\n\nGlobal Claude prompt"]);
  });

  it("should skip system entries that do not match known agent base prompts", async () => {
    // Arrange
    const agentSections = new Map<string, AgentSectionsEntry>([
      ["coder", { base: "Agent base prompt", segments: [] }],
    ]);
    const vendorPrompts = new Map<string, string>([["gpt", "Global GPT prompt"]]);
    const transform = getSystemTransformHook(agentSections, vendorPrompts);

    const input = { model: { id: "openai/gpt-4o" } };
    const output = {
      system: [
        "Runtime system wrapper from opencode",
        "Agent base prompt",
        "Another non-agent system line",
      ],
    };

    // Act
    await transform?.(input as never, output as never);

    // Assert
    expect(output.system).toEqual([
      "Runtime system wrapper from opencode",
      "Agent base prompt\n\nGlobal GPT prompt",
      "Another non-agent system line",
    ]);
  });

  it("should not inject vendor prompts when vendor prompt map is empty", async () => {
    // Arrange
    const agentSections = new Map<string, AgentSectionsEntry>([
      ["coder", { base: "Agent base prompt", segments: [] }],
    ]);
    const vendorPrompts = new Map<string, string>();
    const transform = getSystemTransformHook(agentSections, vendorPrompts);

    const input = { model: { id: "anthropic/claude-3-5-sonnet" } };
    const output = { system: ["Agent base prompt"] };

    // Act
    await transform?.(input as never, output as never);

    // Assert
    expect(output.system).toEqual(["Agent base prompt"]);
  });

  it("should not inject vendor prompt when model family is unknown", async () => {
    // Arrange
    const agentSections = new Map<string, AgentSectionsEntry>([
      ["coder", { base: "Agent base prompt", segments: [] }],
    ]);
    const vendorPrompts = new Map<string, string>([["claude", "Global Claude prompt"]]);
    const transform = getSystemTransformHook(agentSections, vendorPrompts);

    const input = { model: { id: "mistral/large" } };
    const output = { system: ["Agent base prompt"] };

    // Act
    await transform?.(input as never, output as never);

    // Assert
    expect(output.system).toEqual(["Agent base prompt"]);
  });

  it("should append per-agent claude model section for claude model IDs", async () => {
    // Arrange
    const agentSections = new Map<string, AgentSectionsEntry>([
      [
        "coder",
        {
          base: "Base system prompt",
          segments: [{ target: "claude", text: "Claude section content" }],
        },
      ],
    ]);
    const transform = getSystemTransformHook(agentSections, new Map<string, string>());

    const input = { model: { id: "claude-3-opus" } };
    const output = { system: ["Base system prompt"] };

    // Act
    await transform?.(input as never, output as never);

    // Assert
    expect(output.system).toEqual(["Base system prompt\n\nClaude section content"]);
  });

  it("should assert the final transformed system output without fixture chaining", async () => {
    // Arrange
    const agentSections = new Map<string, AgentSectionsEntry>([
      [
        "coder",
        {
          base: "Base system prompt",
          segments: [{ target: "claude", text: "Claude section content" }],
        },
      ],
    ]);
    const vendorPrompts = new Map<string, string>([["claude", "Global Claude prompt"]]);
    const transform = getSystemTransformHook(agentSections, vendorPrompts);

    const input = { model: { id: "anthropic/claude-3-7-sonnet" } };
    const output = { system: ["Base system prompt"] };

    // Act
    await transform?.(input as never, output as never);

    // Assert
    expect(output.system).toEqual([
      "Base system prompt\n\nClaude section content\n\nGlobal Claude prompt",
    ]);
  });

  it("should inject only the exact agent when one base is a prefix of another", async () => {
    // Arrange
    const shortBase = "You are helpful.";
    const longBase = "You are helpful.\nUse JSON output.";
    const agentSections = new Map<string, AgentSectionsEntry>([
      [
        "short-agent",
        {
          base: shortBase,
          segments: [{ target: "gpt", text: "Short agent section" }],
        },
      ],
      [
        "long-agent",
        {
          base: longBase,
          segments: [{ target: "gpt", text: "Long agent section" }],
        },
      ],
    ]);
    const transform = getSystemTransformHook(agentSections, new Map<string, string>());

    const input = { model: { id: "openai/gpt-4o" } };
    const output = { system: [longBase] };

    // Act
    await transform?.(input as never, output as never);

    // Assert
    expect(output.system).toEqual([`${longBase}\n\nLong agent section`]);
  });

  it("should append vendor prompt only once when multiple agents match same system entry", async () => {
    // Arrange
    const sharedBase = "Shared base prompt";
    const agentSections = new Map<string, AgentSectionsEntry>([
      ["agent-one", { base: sharedBase, segments: [] }],
      ["agent-two", { base: sharedBase, segments: [] }],
    ]);
    const vendorPrompts = new Map<string, string>([["gpt", "Global GPT prompt"]]);
    const transform = getSystemTransformHook(agentSections, vendorPrompts);
    const output = { system: [sharedBase] };

    // Act
    await transform?.({ model: { id: "openai/gpt-4o" } } as never, output as never);

    // Assert
    expect(output.system).toEqual([`${sharedBase}\n\nGlobal GPT prompt`]);
    expect(output.system[0]?.match(/Global GPT prompt/g)?.length).toBe(1);
  });
});

describe("detectEmptyResponse via event hook", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should warn when assistant message completes with zero output tokens", async () => {
    // Arrange
    const warnSpy = vi.spyOn(notifier, "warn").mockImplementation(() => undefined);
    const eventHook = getEventHook();

    // Act
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

    // Assert
    expect(warnSpy).toHaveBeenCalledWith(
      "Empty assistant response detected — the model produced no output tokens.",
    );
  });

  it("should not warn when assistant output tokens are non-zero", async () => {
    // Arrange
    const warnSpy = vi.spyOn(notifier, "warn").mockImplementation(() => undefined);
    const eventHook = getEventHook();

    // Act
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

    // Assert
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should not warn for non-message.updated event types", async () => {
    // Arrange
    const warnSpy = vi.spyOn(notifier, "warn").mockImplementation(() => undefined);
    const eventHook = getEventHook();

    // Act
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

    // Assert
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should not warn when event properties are missing", async () => {
    // Arrange
    const warnSpy = vi.spyOn(notifier, "warn").mockImplementation(() => undefined);
    const eventHook = getEventHook();

    // Act
    await eventHook?.({
      event: {
        type: "message.updated",
      },
    } as never);

    // Assert
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should not warn when role is not assistant", async () => {
    // Arrange
    const warnSpy = vi.spyOn(notifier, "warn").mockImplementation(() => undefined);
    const eventHook = getEventHook();

    // Act
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

    // Assert
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should not warn when completed time is missing", async () => {
    // Arrange
    const warnSpy = vi.spyOn(notifier, "warn").mockImplementation(() => undefined);
    const eventHook = getEventHook();

    // Act
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

    // Assert
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should not warn when tokens exists but has no output property", async () => {
    // Arrange
    const warnSpy = vi.spyOn(notifier, "warn").mockImplementation(() => undefined);
    const eventHook = getEventHook();

    // Act
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

    // Assert
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("tool.execute.before skill access gating", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should block skill when deny-mode is active and skill is not allowed", async () => {
    // Arrange
    const { chatParams, toolExecuteBefore } = getSkillHooks(
      new Map([
        [
          "coder",
          {
            "*": "deny",
            typescript: "allow",
          },
        ],
      ]),
    );
    const output = { args: { name: "project-test" } };
    await chatParams?.(
      {
        sessionID: "s1",
        agent: "coder",
      } as never,
      {} as never,
    );

    // Act
    await toolExecuteBefore?.(
      {
        tool: "skill",
        sessionID: "s1",
        callID: "c1",
      } as never,
      output as never,
    );

    // Assert
    expect(output.args).toEqual({ name: "" });
  });

  it("should allow skill when deny-mode is active and skill is explicitly allow", async () => {
    // Arrange
    const { chatParams, toolExecuteBefore } = getSkillHooks(
      new Map([
        [
          "coder",
          {
            "*": "deny",
            typescript: "allow",
          },
        ],
      ]),
    );
    const output = { args: { name: "typescript" } };
    await chatParams?.(
      {
        sessionID: "s1",
        agent: "coder",
      } as never,
      {} as never,
    );

    // Act
    await toolExecuteBefore?.(
      {
        tool: "skill",
        sessionID: "s1",
        callID: "c1",
      } as never,
      output as never,
    );

    // Assert
    expect(output.args).toEqual({ name: "typescript" });
  });

  it("should allow all skills by default when no permission.skill block exists", async () => {
    // Arrange
    const { chatParams, toolExecuteBefore } = getSkillHooks(new Map());
    const output = { args: { name: "project-test" } };
    await chatParams?.(
      {
        sessionID: "s1",
        agent: "coder",
      } as never,
      {} as never,
    );

    // Act
    await toolExecuteBefore?.(
      {
        tool: "skill",
        sessionID: "s1",
        callID: "c1",
      } as never,
      output as never,
    );

    // Assert
    expect(output.args).toEqual({ name: "project-test" });
  });

  it("should allow all skills when permission block does not set '*': 'deny'", async () => {
    // Arrange
    const { chatParams, toolExecuteBefore } = getSkillHooks(
      new Map([
        [
          "coder",
          {
            typescript: "allow",
          },
        ],
      ]),
    );
    const output = { args: { name: "project-test" } };
    await chatParams?.(
      {
        sessionID: "s1",
        agent: "coder",
      } as never,
      {} as never,
    );

    // Act
    await toolExecuteBefore?.(
      {
        tool: "skill",
        sessionID: "s1",
        callID: "c1",
      } as never,
      output as never,
    );

    // Assert
    expect(output.args).toEqual({ name: "project-test" });
  });

  it("should fail open when session is unknown", async () => {
    // Arrange
    const { toolExecuteBefore } = getSkillHooks(
      new Map([
        [
          "coder",
          {
            "*": "deny",
          },
        ],
      ]),
    );
    const output = { args: { name: "project-test" } };

    // Act
    await toolExecuteBefore?.(
      {
        tool: "skill",
        sessionID: "unknown-session",
        callID: "c1",
      } as never,
      output as never,
    );

    // Assert
    expect(output.args).toEqual({ name: "project-test" });
  });

  it("should not modify args when the tool is not 'skill'", async () => {
    // Arrange
    const { chatParams, toolExecuteBefore } = getSkillHooks(
      new Map([["coder", { "*": "deny" }]]),
    );
    const output = { args: { path: "/some/file.ts" } };
    await chatParams?.({ sessionID: "s1", agent: "coder" } as never, {} as never);

    // Act
    await toolExecuteBefore?.(
      { tool: "edit", sessionID: "s1", callID: "c1" } as never,
      output as never,
    );

    // Assert
    expect(output.args).toEqual({ path: "/some/file.ts" });
  });

  it("should warn and block when skill args are not a record", async () => {
    // Arrange
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const { chatParams, toolExecuteBefore } = getSkillHooks(
      new Map([["coder", { "*": "deny" }]]),
    );
    const output = { args: "typescript" };
    await chatParams?.({ sessionID: "s1", agent: "coder" } as never, {} as never);

    // Act
    await toolExecuteBefore?.(
      { tool: "skill", sessionID: "s1", callID: "c1" } as never,
      output as never,
    );

    // Assert
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unexpected non-record args for skill tool call"),
    );
    expect(output.args).toEqual({ name: "" });
  });

  it("should delete session mapping on session.deleted event", async () => {
    // Arrange
    const { chatParams, event, toolExecuteBefore } = getSkillHooks(
      new Map([
        [
          "coder",
          {
            "*": "deny",
          },
        ],
      ]),
    );
    const output = { args: { name: "project-test" } };

    await chatParams?.(
      {
        sessionID: "s1",
        agent: "coder",
      } as never,
      {} as never,
    );

    await event?.(
      {
        event: {
          type: "session.deleted",
          properties: {
            info: {
              id: "s1",
            },
          },
        },
      } as never,
    );

    // Act
    await toolExecuteBefore?.(
      {
        tool: "skill",
        sessionID: "s1",
        callID: "c1",
      } as never,
      output as never,
    );

    // Assert
    expect(output.args).toEqual({ name: "project-test" });
  });
});
