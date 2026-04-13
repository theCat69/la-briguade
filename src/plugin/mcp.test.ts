import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectSkillBashPermissions,
  collectSkillMcps,
  injectSkillBashPermissions,
  injectSkillMcpPermissions,
  mergeSkillMcps,
} from "./mcp/index.js";

import type { Config } from "../types/plugin.js";
import { isRecord } from "../utils/type-guards.js";
import type { SkillBashPermIndex, SkillMcpIndex, SkillMcpMap } from "./mcp/index.js";

vi.mock("node:fs");

const mockReadFileSync = vi.mocked(readFileSync);

function createConfig(): Config {
  return { mcp: {} };
}

describe("collectSkillMcps", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should collect local MCP entries from skill frontmatter", () => {
    // Arrange
    const localSkillDir = "/skills/context7";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "mcp:",
        "  context7:",
        "    type: local",
        "    command: [\"npx\", \"-y\", \"@upstash/context7-mcp@2.1.7\"]",
        "    environment:",
        "      CONTEXT7_CACHE: \"enabled\"",
        "    enabled: true",
        "    timeout: 5000",
        "---",
        "Local skill body",
      ].join("\n"),
    );

    // Act
    const { mcpMap, skillMcpIndex } = collectSkillMcps([localSkillDir]);

    // Assert
    expect(mcpMap).toEqual({
      context7: {
        type: "local",
        command: ["npx", "-y", "@upstash/context7-mcp@2.1.7"],
        environment: { CONTEXT7_CACHE: "enabled" },
        enabled: true,
        timeout: 5000,
      },
    });
    expect(skillMcpIndex).toEqual({
      context7: [{ id: "context7", permission: { "context7_*": "allow" } }],
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
    const { mcpMap, skillMcpIndex } = collectSkillMcps([remoteSkillDir]);

    // Assert
    expect(mcpMap).toEqual({
      docs: {
        type: "remote",
        url: "https://mcp.example.com/sse",
        headers: { Authorization: "Bearer test-token" },
        enabled: true,
        timeout: 4000,
      },
    });
    expect(skillMcpIndex).toEqual({
      "remote-skill": [{ id: "docs", permission: { "docs_*": "allow" } }],
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
    const { mcpMap, skillMcpIndex } = collectSkillMcps([skillDir]);

    // Assert
    expect(mcpMap).toEqual({
      context7: {
        type: "local",
        command: ["npx", "--api-key", "secret-123"],
      },
    });
    expect(skillMcpIndex).toEqual({
      "local-env-command": [{ id: "context7", permission: { "context7_*": "allow" } }],
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
    const { mcpMap, skillMcpIndex } = collectSkillMcps([skillDir]);

    // Assert
    expect(mcpMap).toEqual({
      context7: {
        type: "local",
        command: ["npx", "--api-key", ""],
      },
    });
    expect(skillMcpIndex).toEqual({
      "local-missing-env-command": [
        { id: "context7", permission: { "context7_*": "allow" } },
      ],
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "[la-briguade] MCP server 'context7': env var(s) " +
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
    const { mcpMap, skillMcpIndex } = collectSkillMcps([skillDir]);

    // Assert
    expect(mcpMap).toEqual({
      playwright: {
        type: "local",
        command: ["npx", "-y", "playwright-mcp-latest"],
        environment: {
          PLAYWRIGHT_BROWSERS_PATH: "0",
        },
      },
    });
    expect(skillMcpIndex).toEqual({
      "local-env-map": [{ id: "playwright", permission: { "playwright_*": "allow" } }],
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
    const { mcpMap, skillMcpIndex } = collectSkillMcps([skillDir]);

    // Assert
    expect(mcpMap).toEqual({
      docs: {
        type: "remote",
        url: "https://mcp.example.com/sse",
        headers: {
          Authorization: "Bearer abc123",
        },
      },
    });
    expect(skillMcpIndex).toEqual({
      "remote-env-headers": [{ id: "docs", permission: { "docs_*": "allow" } }],
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
    const { mcpMap, skillMcpIndex } = collectSkillMcps([skillDir]);

    // Assert
    expect(mcpMap).toEqual({
      context7: {
        type: "local",
        command: ["npx", "-y", "@upstash/context7-mcp@2.1.7"],
      },
    });
    expect(skillMcpIndex).toEqual({
      "local-no-env-tokens": [{ id: "context7", permission: { "context7_*": "allow" } }],
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
    const { mcpMap, skillMcpIndex } = collectSkillMcps([skillDir]);

    // Assert
    // This remains one argv element; no shell splitting is performed.
    expect(mcpMap).toEqual({
      context7: {
        type: "local",
        command: ["npx", "Bearer abc123"],
      },
    });
    expect(skillMcpIndex).toEqual({
      "local-multiple-env-tokens": [
        { id: "context7", permission: { "context7_*": "allow" } },
      ],
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
    const { mcpMap, skillMcpIndex } = collectSkillMcps([skillDir]);

    // Assert
    expect(mcpMap).toEqual({
      context7: {
        type: "local",
        command: ["npx", "trimmed-value"],
      },
    });
    expect(skillMcpIndex).toEqual({
      "local-trimmed-env-token": [
        { id: "context7", permission: { "context7_*": "allow" } },
      ],
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
    const { mcpMap, skillMcpIndex } = collectSkillMcps([skillDir]);

    // Assert
    expect(mcpMap).toEqual({
      context7: {
        type: "local",
        command: ["npx", ""],
      },
    });
    expect(skillMcpIndex).toEqual({
      "local-disallowed-resolved-command": [
        { id: "context7", permission: { "context7_*": "allow" } },
      ],
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "[la-briguade] MCP server 'context7': resolved command element contains disallowed " +
        "characters after env substitution — element skipped",
    );
  });

  it("should blank resolved command element containing pipe character and warn", () => {
    // Arrange
    vi.stubEnv("TEST_PIPE_ARG", "safe|unsafe");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const skillDir = "/skills/local-disallowed-pipe-command";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "mcp:",
        "  context7:",
        "    type: local",
        '    command: ["npx", "{env:TEST_PIPE_ARG}"]',
        "---",
        "Body",
      ].join("\n"),
    );

    // Act
    const { mcpMap } = collectSkillMcps([skillDir]);

    // Assert
    expect(mcpMap).toEqual({
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
    const { mcpMap, skillMcpIndex } = collectSkillMcps([invalidSkillDir]);

    // Assert
    expect(mcpMap).toEqual({});
    expect(skillMcpIndex).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[la-briguade] Invalid skill MCP frontmatter in:"),
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
    const { mcpMap, skillMcpIndex } = collectSkillMcps([firstSkillDir, secondSkillDir]);

    // Assert
    expect(mcpMap).toEqual({
      playwright: {
        type: "local",
        command: ["npx", "-y", "playwright-mcp-latest"],
      },
    });
    expect(skillMcpIndex).toEqual({
      "first-skill": [{ id: "playwright", permission: { "playwright_*": "allow" } }],
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
    const { mcpMap, skillMcpIndex } = collectSkillMcps([skillDir]);

    // Assert
    expect(mcpMap).toEqual({});
    expect(skillMcpIndex).toEqual({});
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
    const { mcpMap, skillMcpIndex } = collectSkillMcps(["/skills/missing-skill"]);

    // Assert
    expect(mcpMap).toEqual({});
    expect(skillMcpIndex).toEqual({});
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
    const { mcpMap, skillMcpIndex } = collectSkillMcps([unreadableSkillDir, validSkillDir]);

    // Assert
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[la-briguade] Could not read skill file:"),
    );
    expect(mcpMap).toEqual({
      docs: {
        type: "remote",
        url: "https://mcp.example.com/sse",
      },
    });
    expect(skillMcpIndex).toEqual({
      "valid-skill": [{ id: "docs", permission: { "docs_*": "allow" } }],
    });
  });
});

function createInjectConfig(permission: Record<string, unknown> | undefined): Config {
  const config = createConfig();
  // Config comes from plugin API typing; tests attach `agent` dynamically for fixtures.
  const mutableConfig = config as Record<string, unknown>;
  if (permission === undefined) {
    mutableConfig["agent"] = { ask: {} };
    return config;
  }

  mutableConfig["agent"] = {
    ask: {
      permission,
    },
  };
  return config;
}

function getAskPermission(config: Config): Record<string, unknown> | undefined {
  // Fixture shape is controlled in this file via createInjectConfig.
  const configRecord = config as Record<string, unknown>;
  const agent = configRecord["agent"] as Record<string, unknown> | undefined;
  const ask = agent?.["ask"] as Record<string, unknown> | undefined;
  const permission = ask?.["permission"];
  return isRecord(permission) ? permission : undefined;
}

describe("injectSkillMcpPermissions", () => {
  it("should inject prefixed permissions when skill is 'allow'", () => {
    // Arrange
    const config = createInjectConfig({ skill: { context7: "allow" } });
    const skillMcpIndex: SkillMcpIndex = {
      context7: [{ id: "context7", permission: { "context7_*": "allow" } }],
    };

    // Act
    injectSkillMcpPermissions(config, skillMcpIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { context7: "allow" },
      "context7_*": "allow",
    });
  });

  it("should inject prefixed permissions when skill is 'ask'", () => {
    // Arrange
    const config = createInjectConfig({ skill: { context7: "ask" } });
    const skillMcpIndex: SkillMcpIndex = {
      context7: [{ id: "context7", permission: { "context7_*": "allow" } }],
    };

    // Act
    injectSkillMcpPermissions(config, skillMcpIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { context7: "ask" },
      "context7_*": "allow",
    });
  });

  it("should NOT inject when skill is 'deny'", () => {
    // Arrange
    const config = createInjectConfig({ skill: { context7: "deny" } });
    const skillMcpIndex: SkillMcpIndex = {
      context7: [{ id: "context7", permission: { "context7_*": "allow" } }],
    };

    // Act
    injectSkillMcpPermissions(config, skillMcpIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { context7: "deny" },
    });
  });

  it("should inject via wildcard skill allow", () => {
    // Arrange
    const config = createInjectConfig({ skill: { "*": "allow" } });
    const skillMcpIndex: SkillMcpIndex = {
      context7: [{ id: "context7", permission: { "context7_*": "allow" } }],
    };

    // Act
    injectSkillMcpPermissions(config, skillMcpIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { "*": "allow" },
      "context7_*": "allow",
    });
  });

  it("should NOT inject via wildcard skill deny", () => {
    // Arrange
    const config = createInjectConfig({ skill: { "*": "deny" } });
    const skillMcpIndex: SkillMcpIndex = {
      context7: [{ id: "context7", permission: { "context7_*": "allow" } }],
    };

    // Act
    injectSkillMcpPermissions(config, skillMcpIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { "*": "deny" },
    });
  });

  it("should skip injection when resolved skill permission is neither allow nor ask", () => {
    // Arrange
    const config = createInjectConfig({
      skill: { "playwright-cli": "unknown", "*": "unknown" },
    });
    const skillBashPermIndex: SkillBashPermIndex = {
      "playwright-cli": { "playwright-cli *": "allow" },
    };

    // Act
    injectSkillBashPermissions(config, skillBashPermIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { "playwright-cli": "unknown", "*": "unknown" },
    });
  });

  it("should NOT overwrite existing agent permission key", () => {
    // Arrange
    const config = createInjectConfig({
      skill: { context7: "allow" },
      "context7_*": "ask",
    });
    const skillMcpIndex: SkillMcpIndex = {
      context7: [{ id: "context7", permission: { "context7_*": "allow" } }],
    };

    // Act
    injectSkillMcpPermissions(config, skillMcpIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { context7: "allow" },
      "context7_*": "ask",
    });
  });

  it("should do nothing when agent has no permission block", () => {
    // Arrange
    const config = createInjectConfig(undefined);
    const skillMcpIndex: SkillMcpIndex = {
      context7: [{ id: "context7", permission: { "context7_*": "allow" } }],
    };

    // Act
    injectSkillMcpPermissions(config, skillMcpIndex);

    // Assert
    expect(config.agent?.ask).toEqual({});
  });

  it("should do nothing when agent has no skill sub-block", () => {
    // Arrange
    const config = createInjectConfig({ read: "allow" });
    const skillMcpIndex: SkillMcpIndex = {
      context7: [{ id: "context7", permission: { "context7_*": "allow" } }],
    };

    // Act
    injectSkillMcpPermissions(config, skillMcpIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      read: "allow",
    });
  });

  it("should use custom permission block from SKILL.md (prefixed)", () => {
    // Arrange
    const config = createInjectConfig({ skill: { context7: "allow" } });
    const skillMcpIndex: SkillMcpIndex = {
      context7: [
        {
          id: "context7",
          permission: {
            "context7_resolve-library-id": "allow",
          },
        },
      ],
    };

    // Act
    injectSkillMcpPermissions(config, skillMcpIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { context7: "allow" },
      "context7_resolve-library-id": "allow",
    });
  });

  it("should NOT inject 'deny' values from permission block", () => {
    // Arrange
    const config = createInjectConfig({ skill: { context7: "allow" } });
    const skillMcpIndex: SkillMcpIndex = {
      context7: [
        {
          id: "context7",
          permission: {
            "context7_dangerous-tool": "deny",
          },
        },
      ],
    };

    // Act
    injectSkillMcpPermissions(config, skillMcpIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { context7: "allow" },
    });
  });

  it("should inject multiple MCP bindings from same skill", () => {
    // Arrange
    const config = createInjectConfig({ skill: { context7: "allow" } });
    const skillMcpIndex: SkillMcpIndex = {
      context7: [
        { id: "context7", permission: { "context7_*": "allow" } },
        {
          id: "context7-extra",
          permission: { "context7-extra_*": "allow" },
        },
      ],
    };

    // Act
    injectSkillMcpPermissions(config, skillMcpIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { context7: "allow" },
      "context7_*": "allow",
      "context7-extra_*": "allow",
    });
  });

  it("should fallback to wildcard permission when binding.permission is empty", () => {
    // Arrange
    const config = createInjectConfig({ skill: { context7: "allow" } });
    const skillMcpIndex: SkillMcpIndex = {
      context7: [{ id: "context7", permission: {} }],
    };

    // Act
    injectSkillMcpPermissions(config, skillMcpIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { context7: "allow" },
      "context7_*": "allow",
    });
  });
});

describe("collectSkillBashPermissions", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should collect bash permissions from skill with permission.bash frontmatter", () => {
    // Arrange
    const skillDir = "/skills/playwright-cli";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "permission:",
        "  bash:",
        '    "playwright-cli *": "allow"',
        "---",
        "Body",
      ].join("\n"),
    );

    // Act
    const skillBashPermIndex = collectSkillBashPermissions([skillDir]);

    // Assert
    expect(skillBashPermIndex).toEqual({
      "playwright-cli": {
        "playwright-cli *": "allow",
      },
    });
  });

  it("should return empty index when skill has no permission field", () => {
    // Arrange
    const skillDir = "/skills/no-permission";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "name: no-permission",
        "description: no permission field",
        "---",
        "Body",
      ].join("\n"),
    );

    // Act
    const skillBashPermIndex = collectSkillBashPermissions([skillDir]);

    // Assert
    expect(skillBashPermIndex).toEqual({});
  });

  it("should return empty index when permission.bash is absent", () => {
    // Arrange
    const skillDir = "/skills/permission-without-bash";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "permission:",
        "  other: something",
        "---",
        "Body",
      ].join("\n"),
    );

    // Act
    const skillBashPermIndex = collectSkillBashPermissions([skillDir]);

    // Assert
    expect(skillBashPermIndex).toEqual({});
  });

  it("should warn and skip skill with invalid permission frontmatter", () => {
    // Arrange
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const skillDir = "/skills/invalid-permission";
    mockReadFileSync.mockReturnValue(
      [
        "---",
        "permission: not-an-object",
        "---",
        "Body",
      ].join("\n"),
    );

    // Act
    const skillBashPermIndex = collectSkillBashPermissions([skillDir]);

    // Assert
    expect(skillBashPermIndex).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[la-briguade] Invalid skill permission frontmatter in:"),
    );
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
    const skillBashPermIndex = collectSkillBashPermissions(["/skills/missing-skill"]);

    // Assert
    expect(skillBashPermIndex).toEqual({});
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should collect bash permissions from multiple skill dirs", () => {
    // Arrange
    const frontendSkillDir = "/skills/frontend";
    const playwrightSkillDir = "/skills/playwright-cli";

    mockReadFileSync.mockImplementation((path) => {
      if (String(path).includes("frontend")) {
        return [
          "---",
          "permission:",
          "  bash:",
          '    "playwright-cli *": "allow"',
          "---",
          "Body",
        ].join("\n");
      }

      return [
        "---",
        "permission:",
        "  bash:",
        '    "other-tool *": "ask"',
        "---",
        "Body",
      ].join("\n");
    });

    // Act
    const skillBashPermIndex = collectSkillBashPermissions([frontendSkillDir, playwrightSkillDir]);

    // Assert
    expect(skillBashPermIndex).toEqual({
      frontend: {
        "playwright-cli *": "allow",
      },
      "playwright-cli": {
        "other-tool *": "ask",
      },
    });
  });
});

describe("injectSkillBashPermissions", () => {
  it("should inject bash permission section when skill is 'allow'", () => {
    // Arrange
    const config = createInjectConfig({ skill: { "playwright-cli": "allow" } });
    const skillBashPermIndex: SkillBashPermIndex = {
      "playwright-cli": { "playwright-cli *": "allow" },
    };

    // Act
    injectSkillBashPermissions(config, skillBashPermIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { "playwright-cli": "allow" },
      bash: { "playwright-cli *": "allow" },
    });
  });

  it("should inject bash permission section when skill is 'ask'", () => {
    // Arrange
    const config = createInjectConfig({ skill: { "playwright-cli": "ask" } });
    const skillBashPermIndex: SkillBashPermIndex = {
      "playwright-cli": { "playwright-cli *": "allow" },
    };

    // Act
    injectSkillBashPermissions(config, skillBashPermIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { "playwright-cli": "ask" },
      bash: { "playwright-cli *": "allow" },
    });
  });

  it("should NOT inject when skill is 'deny'", () => {
    // Arrange
    const config = createInjectConfig({ skill: { "playwright-cli": "deny" } });
    const skillBashPermIndex: SkillBashPermIndex = {
      "playwright-cli": { "playwright-cli *": "allow" },
    };

    // Act
    injectSkillBashPermissions(config, skillBashPermIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { "playwright-cli": "deny" },
    });
  });

  it("should inject via wildcard skill allow", () => {
    // Arrange
    const config = createInjectConfig({ skill: { "*": "allow" } });
    const skillBashPermIndex: SkillBashPermIndex = {
      "playwright-cli": { "playwright-cli *": "allow" },
    };

    // Act
    injectSkillBashPermissions(config, skillBashPermIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { "*": "allow" },
      bash: { "playwright-cli *": "allow" },
    });
  });

  it("should NOT inject via wildcard skill deny", () => {
    // Arrange
    const config = createInjectConfig({ skill: { "*": "deny" } });
    const skillBashPermIndex: SkillBashPermIndex = {
      "playwright-cli": { "playwright-cli *": "allow" },
    };

    // Act
    injectSkillBashPermissions(config, skillBashPermIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { "*": "deny" },
    });
  });

  it("should NOT overwrite existing bash permission key", () => {
    // Arrange
    const config = createInjectConfig({
      skill: { "playwright-cli": "allow" },
      bash: { "playwright-cli *": "ask" },
    });
    const skillBashPermIndex: SkillBashPermIndex = {
      "playwright-cli": { "playwright-cli *": "allow" },
    };

    // Act
    injectSkillBashPermissions(config, skillBashPermIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { "playwright-cli": "allow" },
      bash: { "playwright-cli *": "ask" },
    });
  });

  it("should skip 'deny' values in skill bash permission block", () => {
    // Arrange
    const config = createInjectConfig({ skill: { "playwright-cli": "allow" } });
    const skillBashPermIndex: SkillBashPermIndex = {
      "playwright-cli": { "playwright-cli *": "deny" },
    };

    // Act
    injectSkillBashPermissions(config, skillBashPermIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { "playwright-cli": "allow" },
    });
  });

  it("should do nothing when agent has no permission block", () => {
    // Arrange
    const config = createInjectConfig(undefined);
    const skillBashPermIndex: SkillBashPermIndex = {
      "playwright-cli": { "playwright-cli *": "allow" },
    };

    // Act
    injectSkillBashPermissions(config, skillBashPermIndex);

    // Assert
    expect(config.agent?.ask).toEqual({});
  });

  it("should do nothing when agent has no skill sub-block", () => {
    // Arrange
    const config = createInjectConfig({ read: "allow" });
    const skillBashPermIndex: SkillBashPermIndex = {
      "playwright-cli": { "playwright-cli *": "allow" },
    };

    // Act
    injectSkillBashPermissions(config, skillBashPermIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      read: "allow",
    });
  });

  it("should append to existing bash section without overwriting other entries", () => {
    // Arrange
    const config = createInjectConfig({
      skill: { "playwright-cli": "allow" },
      bash: { "other-tool *": "allow" },
    });
    const skillBashPermIndex: SkillBashPermIndex = {
      "playwright-cli": { "playwright-cli *": "allow" },
    };

    // Act
    injectSkillBashPermissions(config, skillBashPermIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { "playwright-cli": "allow" },
      bash: {
        "other-tool *": "allow",
        "playwright-cli *": "allow",
      },
    });
  });

  it("should preserve scalar bash permission and skip skill injection", () => {
    // Arrange
    const config = createInjectConfig({
      skill: { "playwright-cli": "allow" },
      bash: "allow",
    });
    const skillBashPermIndex: SkillBashPermIndex = {
      "playwright-cli": { "playwright-cli *": "allow" },
    };

    // Act
    injectSkillBashPermissions(config, skillBashPermIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { "playwright-cli": "allow" },
      bash: "allow",
    });
  });

  it("should treat null bash permission as absent and inject patterns", () => {
    // Arrange
    const config = createInjectConfig({
      skill: { "playwright-cli": "allow" },
      bash: null,
    });
    const skillBashPermIndex: SkillBashPermIndex = {
      "playwright-cli": { "playwright-cli *": "allow" },
    };

    // Act
    injectSkillBashPermissions(config, skillBashPermIndex);

    // Assert
    expect(getAskPermission(config)).toEqual({
      skill: { "playwright-cli": "allow" },
      bash: { "playwright-cli *": "allow" },
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
