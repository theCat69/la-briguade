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
    vi.unstubAllEnvs();
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

  it("should resolve {env:VAR} tokens in local MCP command elements", () => {
    // Arrange
    vi.stubEnv("TEST_CONTEXT7_API_KEY", "secret-123");
    const skillDir = "/skills/local-env-command";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "mcp:",
        "  context7:",
        "    type: local",
        '    command: ["npx", "--api-key", "{env:TEST_CONTEXT7_API_KEY}"]',
        "---",
        "Body",
      ].join("\n"),
    );

    // Act
    const result = collectSkillMcps([skillDir]);

    // Assert
    expect(result).toEqual({
      context7: {
        type: "local",
        command: ["npx", "--api-key", "secret-123"],
      },
    });
  });

  it("should resolve missing {env:VAR} token to empty string and warn", () => {
    // Arrange
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const skillDir = "/skills/local-missing-env-command";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "mcp:",
        "  context7:",
        "    type: local",
        '    command: ["npx", "--api-key", "{env:LA_BRIGUADE_TEST_MISSING_ENV}"]',
        "---",
        "Body",
      ].join("\n"),
    );

    // Act
    const result = collectSkillMcps([skillDir]);

    // Assert
    expect(result).toEqual({
      context7: {
        type: "local",
        command: ["npx", "--api-key", ""],
      },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "[la-briguade] MCP server 'context7': env var " +
        "'LA_BRIGUADE_TEST_MISSING_ENV' referenced in command is not set",
    );
  });

  it("should resolve {env:VAR} tokens in local MCP environment values", () => {
    // Arrange
    vi.stubEnv("TEST_PLAYWRIGHT_BROWSERS_PATH", "0");
    const skillDir = "/skills/local-env-map";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "mcp:",
        "  playwright:",
        "    type: local",
        '    command: ["npx", "-y", "playwright-mcp-latest"]',
        "    environment:",
        '      PLAYWRIGHT_BROWSERS_PATH: "{env:TEST_PLAYWRIGHT_BROWSERS_PATH}"',
        "---",
        "Body",
      ].join("\n"),
    );

    // Act
    const result = collectSkillMcps([skillDir]);

    // Assert
    expect(result).toEqual({
      playwright: {
        type: "local",
        command: ["npx", "-y", "playwright-mcp-latest"],
        environment: {
          PLAYWRIGHT_BROWSERS_PATH: "0",
        },
      },
    });
  });

  it("should resolve {env:VAR} tokens in remote MCP header values", () => {
    // Arrange
    vi.stubEnv("TEST_MCP_AUTH_TOKEN", "abc123");
    const skillDir = "/skills/remote-env-headers";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "mcp:",
        "  docs:",
        "    type: remote",
        "    url: https://mcp.example.com/sse",
        "    headers:",
        '      Authorization: "Bearer {env:TEST_MCP_AUTH_TOKEN}"',
        "---",
        "Body",
      ].join("\n"),
    );

    // Act
    const result = collectSkillMcps([skillDir]);

    // Assert
    expect(result).toEqual({
      docs: {
        type: "remote",
        url: "https://mcp.example.com/sse",
        headers: {
          Authorization: "Bearer abc123",
        },
      },
    });
  });

  it("should accept scoped npm package command elements", () => {
    // Arrange
    const skillDir = "/skills/local-no-env-tokens";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "mcp:",
        "  context7:",
        "    type: local",
        '    command: ["npx", "-y", "@upstash/context7-mcp@2.1.7"]',
        "---",
        "Body",
      ].join("\n"),
    );

    // Act
    const result = collectSkillMcps([skillDir]);

    // Assert
    expect(result).toEqual({
      context7: {
        type: "local",
        command: ["npx", "-y", "@upstash/context7-mcp@2.1.7"],
      },
    });
  });

  it("should resolve multiple {env:VAR} tokens in a single string", () => {
    // Arrange
    vi.stubEnv("TEST_TOKEN_PREFIX", "Bearer");
    vi.stubEnv("TEST_TOKEN_VALUE", "abc123");
    const skillDir = "/skills/local-multiple-env-tokens";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "mcp:",
        "  context7:",
        "    type: local",
        '    command: ["npx", "{env:TEST_TOKEN_PREFIX} {env:TEST_TOKEN_VALUE}"]',
        "---",
        "Body",
      ].join("\n"),
    );

    // Act
    const result = collectSkillMcps([skillDir]);

    // Assert
    // This remains one argv element; no shell splitting is performed.
    expect(result).toEqual({
      context7: {
        type: "local",
        command: ["npx", "Bearer abc123"],
      },
    });
  });

  it("should trim env var names inside {env:...} tokens", () => {
    // Arrange
    vi.stubEnv("TEST_TRIMMED_ENV", "trimmed-value");
    const skillDir = "/skills/local-trimmed-env-token";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "mcp:",
        "  context7:",
        "    type: local",
        '    command: ["npx", "{env: TEST_TRIMMED_ENV }"]',
        "---",
        "Body",
      ].join("\n"),
    );

    // Act
    const result = collectSkillMcps([skillDir]);

    // Assert
    expect(result).toEqual({
      context7: {
        type: "local",
        command: ["npx", "trimmed-value"],
      },
    });
  });

  it("should skip resolved command element with disallowed characters and warn", () => {
    // Arrange
    vi.stubEnv("TEST_BAD_ARG", "abc$def");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const skillDir = "/skills/local-disallowed-resolved-command";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "mcp:",
        "  context7:",
        "    type: local",
        '    command: ["npx", "{env:TEST_BAD_ARG}"]',
        "---",
        "Body",
      ].join("\n"),
    );

    // Act
    const result = collectSkillMcps([skillDir]);

    // Assert
    expect(result).toEqual({
      context7: {
        type: "local",
        command: ["npx", ""],
      },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "[la-briguade] MCP server 'context7': resolved command element contains disallowed " +
        "characters after env substitution — element skipped",
    );
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
        "    command: [\"npx\", \"echo$hi\"]",
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
