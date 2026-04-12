import { afterEach, describe, expect, it, vi } from "vitest";

import { registerAgents } from "./agents.js";

import type { LaBriguadeConfig } from "../config/schema.js";
import type { Config } from "../types/plugin.js";
import { collectFiles } from "../utils/content-merge.js";
import { logger } from "../utils/logger.js";
import { readContentFile } from "../utils/read-content-file.js";

vi.mock("../utils/content-merge.js");
vi.mock("../utils/read-content-file.js");

const mockCollectFiles = vi.mocked(collectFiles);
const mockReadContentFile = vi.mocked(readContentFile);

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
    mockReadContentFile.mockImplementation((filePath) => {
      if (String(filePath).endsWith("bad.md")) {
        throw new Error(`Could not read content file: ${String(filePath)}`);
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
    mockReadContentFile.mockImplementation((filePath) => {
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
      expect.stringContaining("[la-briguade] duplicate agent name in sections map: 'coder'"),
    );
    const coder = config.agent?.["coder"] as Record<string, unknown> | undefined;
    expect(coder?.["prompt"]).toBe("Base two");
    expect(result.agentSections.get("coder")?.base).toBe("Base two");
  });

  it("should swap opus model to sonnet when opus_enabled is false", () => {
    // Arrange
    mockCollectFiles.mockReturnValue(new Map([["Coder", "/builtin/agents/Coder.md"]]));
    mockReadContentFile.mockReturnValue(
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

  it("should register overridden agent from later directory", () => {
    // Arrange
    mockCollectFiles.mockReturnValue(new Map([["coder", "/project/content/agents/coder.md"]]));
    mockReadContentFile.mockReturnValue(
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

  it("should warn and skip unsafe permission.skill keys like __proto__", () => {
    // Arrange
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    mockCollectFiles.mockReturnValue(new Map([["Coder", "/builtin/agents/Coder.md"]]));
    mockReadContentFile.mockReturnValue(
      [
        "---",
        "permission:",
        "  skill:",
        '    "*": "deny"',
        '    __proto__: "allow"',
        "---",
        "Body",
      ].join("\n"),
    );
    const config = makeConfig();

    // Act
    registerAgents(config, ["/builtin/agents"]);

    // Assert
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('permission.skill key "__proto__" is unsafe'),
    );
  });

  it("should warn and skip unrecognized permission.skill values like 'DENY'", () => {
    // Arrange
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    mockCollectFiles.mockReturnValue(new Map([["Coder", "/builtin/agents/Coder.md"]]));
    mockReadContentFile.mockReturnValue(
      ["---", "permission:", "  skill:", '    "*": "DENY"', "---", "Body"].join("\n"),
    );
    const config = makeConfig();

    // Act
    registerAgents(config, ["/builtin/agents"]);

    // Assert
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('permission.skill entry "*" has unrecognized value "DENY"'),
    );
  });

  it("should warn and skip non-string permission.skill values", () => {
    // Arrange
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    mockCollectFiles.mockReturnValue(new Map([["Coder", "/builtin/agents/Coder.md"]]));
    mockReadContentFile.mockReturnValue(
      ["---", "permission:", "  skill:", "    typescript: true", "---", "Body"].join("\n"),
    );
    const config = makeConfig();

    // Act
    const result = registerAgents(config, ["/builtin/agents"]);

    // Assert
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'permission.skill entry "typescript" has non-string value (boolean)',
      ),
    );
    expect(result.agentSkillPerms.get("coder")).toBeUndefined();
  });

  it("should accept ask in permission.skill and include it in agentSkillPerms", () => {
    // Arrange
    mockCollectFiles.mockReturnValue(new Map([["Coder", "/builtin/agents/Coder.md"]]));
    mockReadContentFile.mockReturnValue(
      [
        "---",
        "permission:",
        "  skill:",
        '    "*": "deny"',
        '    typescript: "ask"',
        "---",
        "Body",
      ].join("\n"),
    );
    const config = makeConfig();

    // Act
    const result = registerAgents(config, ["/builtin/agents"]);

    // Assert
    expect(result.agentSkillPerms.get("coder")).toEqual({
      "*": "deny",
      typescript: "ask",
    });
  });

  it("should return early and keep config unchanged when no agent files are found", () => {
    // Arrange
    mockCollectFiles.mockReturnValue(new Map());
    const config = makeConfig();
    const initialConfig = { ...config };

    // Act
    const result = registerAgents(config, []);

    // Assert
    expect(result.agentSections.size).toBe(0);
    expect(result.agentSkillPerms.size).toBe(0);
    expect(config).toEqual(initialConfig);
  });
});
