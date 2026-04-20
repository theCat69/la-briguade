import { describe, it, expect } from "vitest";

import type { AgentConfig } from "@opencode-ai/sdk";

import { resolveAgentConfig, swapOpusModel } from "./merge.js";
import type { LaBriguadeConfig } from "./schema.js";

// Helper to create a base AgentConfig with minimal required fields
function makeBase(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return { prompt: "Base system prompt.", model: "openai/gpt-4o", ...overrides };
}

describe("resolveAgentConfig", () => {
  it("should apply top-level model default when no per-agent model override", () => {
    // Arrange
    const base = makeBase({ model: "openai/gpt-4o" });
    const userConfig: LaBriguadeConfig = { model: "anthropic/claude-opus-4" };

    // Act
    const result = resolveAgentConfig("coder", base, userConfig);

    // Assert
    expect(result.model).toBe("anthropic/claude-opus-4");
  });

  it("should let per-agent model override win over top-level default", () => {
    // Arrange
    const base = makeBase({ model: "openai/gpt-4o" });
    const userConfig: LaBriguadeConfig = {
      model: "anthropic/claude-opus-4",
      agents: {
        coder: { model: "openai/o3" },
      },
    };

    // Act
    const result = resolveAgentConfig("coder", base, userConfig);

    // Assert — per-agent wins
    expect(result.model).toBe("openai/o3");
  });

  it("should prioritize per-agent model when both global and agent models are configured", () => {
    // Arrange
    const base = makeBase({ model: "openai/gpt-4o" });
    const userConfig: LaBriguadeConfig = {
      model: "github-copilot/claude-opus-4.6",
      agents: {
        reviewer: { model: "github-copilot/gpt-5.3-codex" },
      },
    };

    // Act
    const result = resolveAgentConfig("reviewer", base, userConfig);

    // Assert
    expect(result.model).toBe("github-copilot/gpt-5.3-codex");
  });

  it("should return base unchanged when userConfig has no agents", () => {
    // Arrange
    const base = makeBase({ prompt: "Original prompt.", model: "openai/gpt-4o" });
    const userConfig: LaBriguadeConfig = {};

    // Act
    const result = resolveAgentConfig("coder", base, userConfig);

    // Assert
    expect(result.model).toBe("openai/gpt-4o");
    expect(result.prompt).toBe("Original prompt.");
  });

  it("should apply global model default then per-agent suffix override", () => {
    // Arrange
    const base = makeBase({ prompt: "Base prompt.", model: "openai/gpt-4o" });
    const userConfig: LaBriguadeConfig = {
      model: "anthropic/claude-opus-4",
      agents: {
        coder: { systemPromptSuffix: "Use PNPM." },
      },
    };

    // Act
    const result = resolveAgentConfig("coder", base, userConfig);

    // Assert — global model applied, per-agent suffix appended
    expect(result.model).toBe("anthropic/claude-opus-4");
    expect(result.prompt).toBe("Base prompt.\n\nUse PNPM.");
  });

  it("should not mutate the base object when applying global model default", () => {
    // Arrange
    const base = makeBase({ model: "openai/gpt-4o", prompt: "Original." });
    const originalModel = base.model;
    const originalPrompt = base.prompt;
    const userConfig: LaBriguadeConfig = {
      model: "anthropic/claude-opus-4",
      agents: {
        coder: { systemPromptSuffix: "Extra instruction." },
      },
    };

    // Act
    resolveAgentConfig("coder", base, userConfig);

    // Assert — base is completely unchanged
    expect(base.model).toBe(originalModel);
    expect(base.prompt).toBe(originalPrompt);
  });

  it("should merge per-agent permission overrides with base permission", () => {
    // Arrange
    const base = makeBase({
      permission: {
        edit: "allow",
        webfetch: "ask",
      },
    });
    const userConfig: LaBriguadeConfig = {
      agents: {
        coder: {
          permission: {
            webfetch: "deny",
            external_directory: "allow",
          },
        },
      },
    };

    // Act
    const result = resolveAgentConfig("coder", base, userConfig);

    // Assert
    expect(result.permission).toEqual({
      edit: "allow",
      webfetch: "deny",
      external_directory: "allow",
    });
  });

  it("should use suffix as prompt when base prompt is empty", () => {
    // Arrange
    const base = makeBase({ prompt: "" });
    const userConfig: LaBriguadeConfig = {
      agents: {
        coder: { systemPromptSuffix: "Suffix-only prompt." },
      },
    };

    // Act
    const result = resolveAgentConfig("coder", base, userConfig);

    // Assert
    expect(result.prompt).toBe("Suffix-only prompt.");
  });

  it("should map option overrides to SDK config keys", () => {
    // Arrange
    const base = makeBase();
    const userConfig: LaBriguadeConfig = {
      agents: {
        coder: {
          topP: 0.25,
          topK: 20,
          variant: "reasoning",
          maxTokens: 2048,
        },
      },
    };

    // Act
    const result = resolveAgentConfig("coder", base, userConfig);

    // Assert
    expect(result.top_p).toBe(0.25);
    expect(result.topK).toBe(20);
    expect(result.variant).toBe("reasoning");
    expect(result.maxTokens).toBe(2048);
  });
});

describe("swapOpusModel", () => {
  it("should swap claude-opus-4.6 to claude-sonnet-4.6", () => {
    // Arrange
    const input = "github-copilot/claude-opus-4.6";

    // Act
    const result = swapOpusModel(input);

    // Assert
    expect(result).toBe("github-copilot/claude-sonnet-4.6");
  });

  it("should swap claude-opus-4.5 to claude-sonnet-4.5", () => {
    // Arrange
    const input = "github-copilot/claude-opus-4.5";

    // Act
    const result = swapOpusModel(input);

    // Assert
    expect(result).toBe("github-copilot/claude-sonnet-4.5");
  });

  it("should return sonnet model unchanged (not opus)", () => {
    // Arrange
    const input = "github-copilot/claude-sonnet-4.6";

    // Act
    const result = swapOpusModel(input);

    // Assert
    expect(result).toBe("github-copilot/claude-sonnet-4.6");
  });

  it("should return non-claude model unchanged", () => {
    // Arrange
    const input = "github-copilot/gpt-5.3-codex";

    // Act
    const result = swapOpusModel(input);

    // Assert
    expect(result).toBe("github-copilot/gpt-5.3-codex");
  });

  it("should swap claude-opus-4 (bare version, no dot) to claude-sonnet-4", () => {
    // Arrange
    const input = "anthropic/claude-opus-4";

    // Act
    const result = swapOpusModel(input);

    // Assert
    expect(result).toBe("anthropic/claude-sonnet-4");
  });

  it("should NOT swap a theme-style name that has no digit after opus-", () => {
    // Arrange — non-version suffix starting with a letter must not match
    const input = "github-copilot/claude-opus-themed-dark";

    // Act
    const result = swapOpusModel(input);

    // Assert — unchanged because 't' is not a digit
    expect(result).toBe("github-copilot/claude-opus-themed-dark");
  });
});
