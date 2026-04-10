import { describe, it, expect } from "vitest";

import type { AgentConfig } from "@opencode-ai/sdk";

import { applyAgentOverride, resolveAgentConfig, swapOpusModel } from "./merge.js";
import type { AgentOverride, LaBriguadeConfig } from "./schema.js";

// Helper to create a base AgentConfig with minimal required fields
function makeBase(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return { prompt: "Base system prompt.", model: "openai/gpt-4o", ...overrides };
}

describe("applyAgentOverride", () => {
  it("should append systemPromptSuffix with \\n\\n separator", () => {
    // Arrange
    const base = makeBase({ prompt: "Be helpful." });
    const override: AgentOverride = { systemPromptSuffix: "Always use PNPM." };

    // Act
    const result = applyAgentOverride(base, override);

    // Assert
    expect(result.prompt).toBe("Be helpful.\n\nAlways use PNPM.");
  });

  it("should set systemPromptSuffix as prompt when base has no system prompt", () => {
    // Arrange — base with no prompt property
    const base: AgentConfig = { model: "openai/gpt-4o" };
    const override: AgentOverride = { systemPromptSuffix: "Always use PNPM." };

    // Act
    const result = applyAgentOverride(base, override);

    // Assert — no leading separator when base prompt is absent
    expect(result.prompt).toBe("Always use PNPM.");
  });

  it("should apply model override over base model", () => {
    // Arrange
    const base = makeBase({ model: "openai/gpt-4o" });
    const override: AgentOverride = { model: "anthropic/claude-opus-4" };

    // Act
    const result = applyAgentOverride(base, override);

    // Assert
    expect(result.model).toBe("anthropic/claude-opus-4");
  });

  it("should fall back to base values when override fields are absent", () => {
    // Arrange
    const base = makeBase({
      model: "openai/gpt-4o",
      temperature: 0.7,
      top_p: 0.9,
    });
    const override: AgentOverride = {};

    // Act
    const result = applyAgentOverride(base, override);

    // Assert — no override means base values preserved
    expect(result.model).toBe("openai/gpt-4o");
    expect(result.temperature).toBe(0.7);
    expect(result.top_p).toBe(0.9);
  });

  it("should deep-merge permission: base and override combined, override wins conflicts", () => {
    // Arrange
    const base = makeBase({
      permission: {
        edit: "ask",
        bash: "deny",
      },
    });
    const override: AgentOverride = {
      permission: { bash: "allow", webfetch: "ask" },
    };

    // Act
    const result = applyAgentOverride(base, override);

    // Assert
    const perm = result.permission as Record<string, unknown>;
    expect(perm["edit"]).toBe("ask");       // from base
    expect(perm["bash"]).toBe("allow");     // override wins conflict
    expect(perm["webfetch"]).toBe("ask");   // from override only
  });

  it("should merge tools: base and override combined, override wins conflicts", () => {
    // Arrange
    const base = makeBase({
      tools: { bash: true, webfetch: false },
    });
    const override: AgentOverride = {
      tools: { webfetch: true, edit: false },
    };

    // Act
    const result = applyAgentOverride(base, override);

    // Assert
    expect(result.tools?.["bash"]).toBe(true);      // from base
    expect(result.tools?.["webfetch"]).toBe(true);  // override wins conflict
    expect(result.tools?.["edit"]).toBe(false);     // from override only
  });

  it("should not mutate the base object", () => {
    // Arrange
    const base = makeBase({ model: "openai/gpt-4o" });
    const baseCopy = { ...base };
    const override: AgentOverride = { model: "anthropic/claude-opus-4" };

    // Act
    applyAgentOverride(base, override);

    // Assert — base is unchanged
    expect(base.model).toBe(baseCopy.model);
  });
});

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
