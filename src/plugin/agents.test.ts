import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { registerAgents } from "./agents.js";

import type { LaBriguadeConfig } from "../config/schema.js";
import type { Config } from "../types/plugin.js";
import { collectFiles } from "../utils/content-merge.js";

vi.mock("node:fs");
vi.mock("../utils/content-merge.js");

const mockReadFileSync = vi.mocked(readFileSync);
const mockCollectFiles = vi.mocked(collectFiles);

function makeConfig(): Config {
  return { agent: {} } as Config;
}

describe("registerAgents", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should skip unreadable agent file, warn, and still register other agents", () => {
    // Arrange
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockCollectFiles.mockReturnValue(
      new Map([
        ["good", "/builtin/agents/good.md"],
        ["bad", "/builtin/agents/bad.md"],
      ]),
    );
    mockReadFileSync.mockImplementation((filePath) => {
      if (String(filePath).endsWith("bad.md")) {
        throw new Error("EACCES");
      }
      return [
        "---",
        "description: Good agent",
        "model: openai/gpt-4o",
        "---",
        "Good prompt body",
      ].join("\n");
    });

    const config = makeConfig();

    // Act
    registerAgents(config, ["/builtin/agents"]);

    // Assert
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[la-briguade] skipping /builtin/agents/bad.md:"),
    );
    expect(config.agent?.["good"]).toBeDefined();
    expect(config.agent?.["bad"]).toBeUndefined();
  });

  it("should warn on duplicate derived agent names and keep collision handling behavior", () => {
    // Arrange
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockCollectFiles.mockReturnValue(
      new Map([
        ["Coder", "/builtin/agents/Coder.md"],
        ["coder", "/builtin/agents/coder.md"],
      ]),
    );
    mockReadFileSync.mockImplementation((filePath) => {
      if (String(filePath).endsWith("Coder.md")) {
        return [
          "---",
          "model: openai/gpt-4o",
          "---",
          "Base one",
          "====== CLAUDE ======",
          "Section one",
        ].join("\n");
      }
      return [
        "---",
        "model: openai/gpt-4o-mini",
        "---",
        "Base two",
        "====== CLAUDE ======",
        "Section two",
      ].join("\n");
    });

    const config = makeConfig();

    // Act
    const result = registerAgents(config, ["/builtin/agents"]);

    // Assert
    expect(warnSpy).toHaveBeenCalledWith(
      "[la-briguade] duplicate agent name in sections map: 'coder'",
    );
    const coder = config.agent?.["coder"] as Record<string, unknown> | undefined;
    expect(coder?.["prompt"]).toBe("Base two");
    expect(result.agentSections.get("coder")?.base).toBe("Base two");
  });

  it("should swap opus model to sonnet when opus_enabled is false", () => {
    // Arrange
    mockCollectFiles.mockReturnValue(new Map([["Coder", "/builtin/agents/Coder.md"]]));
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "model: github-copilot/claude-opus-4.6",
        "---",
        "Base prompt",
      ].join("\n"),
    );

    const config = makeConfig();
    const userConfig: LaBriguadeConfig = { opus_enabled: false };

    // Act
    registerAgents(config, ["/builtin/agents"], userConfig);

    // Assert
    const coder = config.agent?.["coder"] as Record<string, unknown> | undefined;
    expect(coder?.["model"]).toBe("github-copilot/claude-sonnet-4.6");
  });

  it("should parse valid frontmatter tools into base agent config", () => {
    // Arrange
    mockCollectFiles.mockReturnValue(new Map([["Coder", "/builtin/agents/Coder.md"]]));
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "tools:",
        "  bash: true",
        "  read: false",
        "---",
        "Base prompt",
      ].join("\n"),
    );

    const config = makeConfig();

    // Act
    registerAgents(config, ["/builtin/agents"]);

    // Assert
    const coder = config.agent?.["coder"] as Record<string, unknown> | undefined;
    expect(coder?.["tools"]).toEqual({ bash: true, read: false });
  });

  it("should leave tools unset when frontmatter tools field is absent", () => {
    // Arrange
    mockCollectFiles.mockReturnValue(new Map([["Coder", "/builtin/agents/Coder.md"]]));
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "description: Coder",
        "model: openai/gpt-4o",
        "---",
        "Base prompt",
      ].join("\n"),
    );

    const config = makeConfig();

    // Act
    registerAgents(config, ["/builtin/agents"]);

    // Assert
    const coder = config.agent?.["coder"] as Record<string, unknown> | undefined;
    expect(coder).toBeDefined();
    expect(coder).not.toHaveProperty("tools");
  });

  it("should let user config tools override frontmatter tools", () => {
    // Arrange
    mockCollectFiles.mockReturnValue(new Map([["Coder", "/builtin/agents/Coder.md"]]));
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "tools:",
        "  bash: true",
        "  read: false",
        "---",
        "Base prompt",
      ].join("\n"),
    );

    const userConfig: LaBriguadeConfig = {
      agents: {
        coder: {
          tools: {
            bash: false,
            write: true,
          },
        },
      },
    };
    const config = makeConfig();

    // Act
    registerAgents(config, ["/builtin/agents"], userConfig);

    // Assert
    const coder = config.agent?.["coder"] as Record<string, unknown> | undefined;
    expect(coder?.["tools"]).toEqual({ bash: false, read: false, write: true });
  });

  it("should warn and skip invalid frontmatter tools keys", () => {
    // Arrange
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockCollectFiles.mockReturnValue(new Map([["Coder", "/builtin/agents/Coder.md"]]));
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "tools:",
        "  bad/key: true",
        "---",
        "Base prompt",
      ].join("\n"),
    );

    const config = makeConfig();

    // Act
    registerAgents(config, ["/builtin/agents"]);

    // Assert
    const coder = config.agent?.["coder"] as Record<string, unknown> | undefined;
    expect(coder).toBeDefined();
    expect(coder).not.toHaveProperty("tools");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[la-briguade] agent coder: invalid tools field —"),
    );
  });

  it("should accept empty frontmatter tools object as a valid no-op", () => {
    // Arrange
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockCollectFiles.mockReturnValue(new Map([["Coder", "/builtin/agents/Coder.md"]]));
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "tools: {}",
        "---",
        "Base prompt",
      ].join("\n"),
    );

    const config = makeConfig();

    // Act
    registerAgents(config, ["/builtin/agents"]);

    // Assert
    const coder = config.agent?.["coder"] as Record<string, unknown> | undefined;
    expect(coder).toBeDefined();
    expect(coder).not.toHaveProperty("tools");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should register overridden agent from later directory", () => {
    // Arrange
    mockCollectFiles.mockReturnValue(new Map([["coder", "/project/content/agents/coder.md"]]));
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "model: openai/gpt-4o-mini",
        "---",
        "Project override prompt",
      ].join("\n"),
    );

    const config = makeConfig();

    // Act
    registerAgents(config, ["/builtin/agents", "/project/content/agents"]);

    // Assert
    const coder = config.agent?.["coder"] as Record<string, unknown> | undefined;
    expect(coder?.["prompt"]).toBe("Project override prompt");
  });
});
