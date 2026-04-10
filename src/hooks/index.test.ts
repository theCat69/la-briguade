import { afterEach, describe, expect, it, vi } from "vitest";

import { createHooks, type AgentSectionsEntry } from "./index.js";

import type { PluginInput } from "../types/plugin.js";

function getSystemTransformHook(
  agentSections: Map<string, AgentSectionsEntry>,
  vendorPrompts: Map<string, string>,
) {
  const hooks = createHooks({} as PluginInput, agentSections, vendorPrompts);
  return hooks["experimental.chat.system.transform"];
}

describe("injectVendorPrompts via experimental.chat.system.transform", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should append vendor prompt to matched agent system string using lowercased family key", async () => {
    // Arrange
    const agentSections = new Map<string, AgentSectionsEntry>([
      ["coder", { base: "Base system prompt", sections: {} }],
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
      ["coder", { base: "Agent base prompt", sections: {} }],
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
      ["coder", { base: "Agent base prompt", sections: {} }],
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
});
