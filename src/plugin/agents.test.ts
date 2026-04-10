import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { registerAgents } from "./agents.js";

import type { LaBriguadeConfig } from "../config/schema.js";
import type { Config } from "../types/plugin.js";
import { readDirSafe } from "../utils/read-dir.js";

vi.mock("node:fs");
vi.mock("../utils/read-dir.js");

const mockReadFileSync = vi.mocked(readFileSync);
const mockReadDirSafe = vi.mocked(readDirSafe);

function makeConfig(): Config {
  return { agent: {} } as Config;
}

describe("registerAgents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should skip unreadable agent file, warn, and still register other agents", () => {
    // Arrange
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockReadDirSafe.mockReturnValue(["good.md", "bad.md"]);
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
    registerAgents(config, "/content");

    // Assert
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[la-briguade] Could not read agent file:"),
    );
    expect(config.agent?.["good"]).toBeDefined();
    expect(config.agent?.["bad"]).toBeUndefined();
  });

  it("should warn on duplicate derived agent names and keep collision handling behavior", () => {
    // Arrange
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockReadDirSafe.mockReturnValue(["Coder.md", "coder.md"]);
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
    const result = registerAgents(config, "/content");

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
    mockReadDirSafe.mockReturnValue(["Coder.md"]);
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
    registerAgents(config, "/content", userConfig);

    // Assert
    const coder = config.agent?.["coder"] as Record<string, unknown> | undefined;
    expect(coder?.["model"]).toBe("github-copilot/claude-sonnet-4.6");
  });
});
