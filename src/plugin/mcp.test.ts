import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { collectSkillMcps, mergeSkillMcps } from "./mcp.js";

import type { Config } from "../types/plugin.js";
import type { SkillMcpMap } from "./mcp.js";

vi.mock("node:fs");

const mockReadFileSync = vi.mocked(readFileSync);

function createConfig(): Config {
  // Partial fixture is acceptable in unit tests; only `mcp` is exercised here.
  return { mcp: {} } as unknown as Config;
}

describe("collectSkillMcps", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should collect local MCP entries from skill frontmatter", () => {
    // Arrange
    const localSkillDir = "/skills/local-skill";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "mcp:",
        "  playwright:",
        "    type: local",
        "    command: [\"npx\", \"-y\", \"playwright-mcp-latest\"]",
        "    environment:",
        "      PLAYWRIGHT_BROWSERS_PATH: \"0\"",
        "    enabled: true",
        "    timeout: 5000",
        "---",
        "Local skill body",
      ].join("\n"),
    );

    // Act
    const result = collectSkillMcps([localSkillDir]);

    // Assert
    expect(result).toEqual({
      playwright: {
        type: "local",
        command: ["npx", "-y", "playwright-mcp-latest"],
        environment: { PLAYWRIGHT_BROWSERS_PATH: "0" },
        enabled: true,
        timeout: 5000,
      },
    });
  });

  it("should collect remote MCP entries from skill frontmatter", () => {
    // Arrange
    const remoteSkillDir = "/skills/remote-skill";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "mcp:",
        "  docs:",
        "    type: remote",
        "    url: https://mcp.example.com/sse",
        "    headers:",
        "      Authorization: Bearer test-token",
        "    enabled: true",
        "    timeout: 4000",
        "---",
        "Remote skill body",
      ].join("\n"),
    );

    // Act
    const result = collectSkillMcps([remoteSkillDir]);

    // Assert
    expect(result).toEqual({
      docs: {
        type: "remote",
        url: "https://mcp.example.com/sse",
        headers: { Authorization: "Bearer test-token" },
        enabled: true,
        timeout: 4000,
      },
    });
  });

  it("should skip invalid MCP frontmatter entries and warn", () => {
    // Arrange
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const invalidSkillDir = "/skills/invalid-skill";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "mcp:",
        "  shell:",
        "    type: local",
        "    command: [\"/bin/sh\", \"-c\", \"echo hi\"]",
        "---",
        "Invalid skill body",
      ].join("\n"),
    );

    // Act
    const result = collectSkillMcps([invalidSkillDir]);

    // Assert
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[la-briguade] Invalid skill MCP frontmatter in:"),
      expect.any(Array),
    );
  });

  it("should keep first key on conflict and warn", () => {
    // Arrange
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const firstSkillDir = "/skills/first-skill";
    const secondSkillDir = "/skills/second-skill";
    mockReadFileSync.mockImplementation((path) => {
      if (String(path).includes("first-skill")) {
        return [
          "---",
          "mcp:",
          "  playwright:",
          "    type: local",
          "    command: [\"npx\", \"-y\", \"playwright-mcp-latest\"]",
          "---",
          "First skill body",
        ].join("\n");
      }

      return [
        "---",
        "mcp:",
        "  playwright:",
        "    type: remote",
        "    url: https://mcp.other.example/sse",
        "---",
        "Second skill body",
      ].join("\n");
    });

    // Act
    const result = collectSkillMcps([firstSkillDir, secondSkillDir]);

    // Assert
    expect(result).toEqual({
      playwright: {
        type: "local",
        command: ["npx", "-y", "playwright-mcp-latest"],
      },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[la-briguade] skill MCP conflict:"),
    );
  });

  it("should skip SKILL.md files without mcp field", () => {
    // Arrange
    const skillDir = "/skills/no-mcp-skill";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "name: no-mcp-skill",
        "description: skill without mcp",
        "---",
        "Body",
      ].join("\n"),
    );

    // Act
    const result = collectSkillMcps([skillDir]);

    // Assert
    expect(result).toEqual({});
  });

  it("should skip missing SKILL.md file without warning", () => {
    // Arrange
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockReadFileSync.mockImplementation(() => {
      const missingError = new Error("ENOENT");
      Object.assign(missingError, { code: "ENOENT" });
      throw missingError;
    });

    // Act
    const result = collectSkillMcps(["/skills/missing-skill"]);

    // Assert
    expect(result).toEqual({});
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should warn and continue when reading SKILL.md fails with non-ENOENT", () => {
    // Arrange
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const unreadableSkillDir = "/skills/unreadable-skill";
    const validSkillDir = "/skills/valid-skill";

    mockReadFileSync.mockImplementation((path) => {
      if (String(path).includes("unreadable-skill")) {
        throw new Error("EACCES: permission denied");
      }

      return [
        "---",
        "mcp:",
        "  docs:",
        "    type: remote",
        "    url: https://mcp.example.com/sse",
        "---",
        "Valid skill body",
      ].join("\n");
    });

    // Act
    const result = collectSkillMcps([unreadableSkillDir, validSkillDir]);

    // Assert
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[la-briguade] Could not read skill file:"),
      expect.any(Error),
    );
    expect(result).toEqual({
      docs: {
        type: "remote",
        url: "https://mcp.example.com/sse",
      },
    });
  });
});

describe("mergeSkillMcps", () => {
  it("should assign collected entries into config.mcp", () => {
    // Arrange
    const config = createConfig();
    const collected: SkillMcpMap = {
      playwright: {
        type: "local",
        command: ["npx", "-y", "playwright-mcp-latest"],
      },
    };

    // Act
    mergeSkillMcps(config, collected);

    // Assert
    expect(config.mcp).toEqual(collected);
  });

  it("should keep user-defined mcp entries when keys conflict", () => {
    // Arrange
    const config = createConfig();
    config.mcp = {
      playwright: {
        type: "remote",
        url: "https://user.example.com/sse",
      },
    };
    const collected: SkillMcpMap = {
      playwright: {
        type: "local",
        command: ["npx", "-y", "playwright-mcp-latest"],
      },
      docs: {
        type: "remote",
        url: "https://docs.example.com/sse",
      },
    };

    // Act
    mergeSkillMcps(config, collected);

    // Assert
    expect(config.mcp).toEqual({
      playwright: {
        type: "remote",
        url: "https://user.example.com/sse",
      },
      docs: {
        type: "remote",
        url: "https://docs.example.com/sse",
      },
    });
  });

  it("should keep config.mcp unchanged when collected map is empty", () => {
    // Arrange
    const config = createConfig();
    config.mcp = {
      playwright: {
        type: "remote",
        url: "https://user.example.com/sse",
      },
    };

    // Act
    mergeSkillMcps(config, {});

    // Assert
    expect(config.mcp).toEqual({
      playwright: {
        type: "remote",
        url: "https://user.example.com/sse",
      },
    });
  });
});
