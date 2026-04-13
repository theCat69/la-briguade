import { afterEach, describe, expect, it, vi } from "vitest";

import LaBriguadePlugin from "./index.js";

import { resolveConfigBaseDirs, resolveOpencodeConfigDir, resolveUserConfig } from "./config/index.js";
import { createHooks } from "./hooks/index.js";
import { registerAgents } from "./plugin/agents.js";
import { registerCommands } from "./plugin/commands.js";
import {
  collectSkillBashPermissions,
  collectSkillMcps,
  injectSkillBashPermissions,
  injectSkillMcpPermissions,
  mergeSkillMcps,
} from "./plugin/mcp/index.js";
import { registerSkills } from "./plugin/skills.js";
import { loadVendorPrompts } from "./plugin/vendors.js";
import type { AgentSectionsEntry } from "./hooks/index.js";
import { initLogger, logger } from "./utils/logger.js";

vi.mock("./config/index.js", () => ({
  resolveConfigBaseDirs: vi.fn(),
  resolveOpencodeConfigDir: vi.fn(),
  resolveUserConfig: vi.fn(),
}));

vi.mock("./hooks/index.js", () => ({
  createHooks: vi.fn(),
}));

vi.mock("./plugin/agents.js", () => ({
  registerAgents: vi.fn(),
}));

vi.mock("./plugin/commands.js", () => ({
  registerCommands: vi.fn(),
}));

vi.mock("./plugin/skills.js", () => ({
  registerSkills: vi.fn(),
}));

vi.mock("./plugin/vendors.js", () => ({
  loadVendorPrompts: vi.fn(),
}));

vi.mock("./plugin/mcp/index.js", () => ({
  collectSkillBashPermissions: vi.fn(),
  collectSkillMcps: vi.fn(),
  injectSkillBashPermissions: vi.fn(),
  injectSkillMcpPermissions: vi.fn(),
  mergeSkillMcps: vi.fn(),
}));

vi.mock("./utils/logger.js", () => ({
  initLogger: vi.fn(),
  logger: {
    setLevel: vi.fn(),
  },
}));

const mockResolveConfigBaseDirs = vi.mocked(resolveConfigBaseDirs);
const mockResolveOpencodeConfigDir = vi.mocked(resolveOpencodeConfigDir);
const mockResolveUserConfig = vi.mocked(resolveUserConfig);
const mockCreateHooks = vi.mocked(createHooks);
const mockRegisterAgents = vi.mocked(registerAgents);
const mockRegisterCommands = vi.mocked(registerCommands);
const mockRegisterSkills = vi.mocked(registerSkills);
const mockLoadVendorPrompts = vi.mocked(loadVendorPrompts);
const mockCollectSkillBashPermissions = vi.mocked(collectSkillBashPermissions);
const mockCollectSkillMcps = vi.mocked(collectSkillMcps);
const mockInjectSkillBashPermissions = vi.mocked(injectSkillBashPermissions);
const mockInjectSkillMcpPermissions = vi.mocked(injectSkillMcpPermissions);
const mockMergeSkillMcps = vi.mocked(mergeSkillMcps);
const mockInitLogger = vi.mocked(initLogger);
const mockSetLevel = vi.mocked(logger.setLevel);

describe("LaBriguadePlugin", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should initialize logger and expose hooks from createHooks", async () => {
    // Arrange
    mockResolveConfigBaseDirs.mockReturnValue({ globalDir: "/global", projectDir: "/project" });
    mockResolveOpencodeConfigDir.mockReturnValue("/config/opencode");
    mockLoadVendorPrompts.mockReturnValue(new Map([["gpt", "Vendor prompt"]]));
    const eventHook = vi.fn();
    mockCreateHooks.mockReturnValue({ event: eventHook });
    mockResolveUserConfig.mockReturnValue({});
    mockRegisterAgents.mockReturnValue({
      agentSections: new Map(),
      agentSkillPerms: new Map(),
    });
    mockRegisterSkills.mockReturnValue({ dirs: [] });
    mockCollectSkillMcps.mockReturnValue({ mcpMap: {}, skillMcpIndex: {} });
    mockCollectSkillBashPermissions.mockReturnValue({});

    // Act
    const plugin = await LaBriguadePlugin({ directory: "/project" } as never);

    // Assert
    expect(mockInitLogger).toHaveBeenCalledOnce();
    expect(mockCreateHooks).toHaveBeenCalledOnce();
    expect(plugin.event).toBe(eventHook);
    expect(typeof plugin.config).toBe("function");
  });

  it("should wire config callback and populate shared agent maps", async () => {
    // Arrange
    mockResolveConfigBaseDirs.mockReturnValue({ globalDir: "/global", projectDir: "/project" });
    mockResolveOpencodeConfigDir.mockReturnValue("/config/opencode");
    mockResolveUserConfig.mockReturnValue({ log_level: "info" });
    mockLoadVendorPrompts.mockReturnValue(new Map([["claude", "Global prompt"]]));

    const sharedSection = {
      base: "Base prompt",
      segments: [{ target: "claude", text: "Claude section" }],
    };
    const sharedPerms = { "*": "deny", typescript: "allow" };
    mockRegisterAgents.mockReturnValue({
      agentSections: new Map([["coder", sharedSection]]),
      agentSkillPerms: new Map([["coder", sharedPerms]]),
    });
    mockRegisterSkills.mockReturnValue({ dirs: ["/skills/typescript"] });
    mockCollectSkillMcps.mockReturnValue({ mcpMap: { context7: {} }, skillMcpIndex: { coder: [] } });
    mockCollectSkillBashPermissions.mockReturnValue({ coder: { "npm *": "allow" } });

    let capturedSections: ReadonlyMap<string, AgentSectionsEntry> | undefined;
    let capturedPerms: ReadonlyMap<string, Record<string, string>> | undefined;
    mockCreateHooks.mockImplementation((_, agentSections, __, agentSkillPerms) => {
      capturedSections = agentSections;
      capturedPerms = agentSkillPerms;
      return { event: vi.fn() };
    });

    // Act
    const plugin = await LaBriguadePlugin({ directory: "/project" } as never);
    const input = {} as never;
    await plugin.config?.(input);

    // Assert
    expect(mockSetLevel).toHaveBeenCalledWith("info");
    expect(mockRegisterAgents).toHaveBeenCalledOnce();
    expect(mockRegisterCommands).toHaveBeenCalledOnce();
    expect(mockRegisterSkills).toHaveBeenCalledOnce();
    expect(mockCollectSkillMcps).toHaveBeenCalledWith(["/skills/typescript"]);
    expect(mockMergeSkillMcps).toHaveBeenCalledWith(input, { context7: {} });
    expect(mockInjectSkillMcpPermissions).toHaveBeenCalledWith(input, { coder: [] });
    expect(mockInjectSkillBashPermissions).toHaveBeenCalledWith(input, {
      coder: { "npm *": "allow" },
    });
    expect(capturedSections?.get("coder")).toEqual(sharedSection);
    expect(capturedPerms?.get("coder")).toEqual(sharedPerms);
  });

  it('should default logger level to "warn" when log_level is missing', async () => {
    // Arrange
    mockResolveConfigBaseDirs.mockReturnValue({ globalDir: "/global", projectDir: "/project" });
    mockResolveOpencodeConfigDir.mockReturnValue("/config/opencode");
    mockResolveUserConfig.mockReturnValue({});
    mockLoadVendorPrompts.mockReturnValue(new Map());
    mockCreateHooks.mockReturnValue({});
    mockRegisterAgents.mockReturnValue({
      agentSections: new Map(),
      agentSkillPerms: new Map(),
    });
    mockRegisterSkills.mockReturnValue({ dirs: [] });
    mockCollectSkillMcps.mockReturnValue({ mcpMap: {}, skillMcpIndex: {} });
    mockCollectSkillBashPermissions.mockReturnValue({});

    // Act
    const plugin = await LaBriguadePlugin({ directory: "/project" } as never);
    await plugin.config?.({} as never);

    // Assert
    expect(mockSetLevel).toHaveBeenCalledWith("warn");
  });
});
