import { afterEach, describe, expect, it, vi } from "vitest";

import LaBriguadePlugin from "./index.js";

import { resolveConfigBaseDirs, resolveOpencodeConfigDir, resolveUserConfig } from "./config/index.js";
import { createHooks } from "./hooks/index.js";
import { registerAgents } from "./plugin/agents.js";
import { registerCommands } from "./plugin/commands.js";
import {
  collectSkillAgents,
  collectSkillBashPermissions,
  collectSkillMcps,
  injectSkillAgentPermissions,
  injectSkillBashPermissions,
  injectSkillMcpPermissions,
  mergeSkillMcps,
} from "./plugin/mcp/index.js";
import { registerSkills } from "./plugin/skills.js";
import { loadVendorPrompts } from "./plugin/vendors.js";
import {
  collectAutoInjectSkills,
  injectAutoInjectSkills,
  resolveActiveSkills,
} from "./plugin/auto-inject.js";
import type { AgentSectionsEntry } from "./hooks/index.js";
import { initLogger, logger } from "./utils/logger.js";
import { startCacheCtrlWatch } from "./utils/cache-ctrl-watch.js";
import { collectDirs } from "./utils/content-merge.js";

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

vi.mock("./plugin/auto-inject.js", () => ({
  collectAutoInjectSkills: vi.fn(),
  injectAutoInjectSkills: vi.fn(),
  resolveActiveSkills: vi.fn(),
}));

vi.mock("./plugin/mcp/index.js", () => ({
  collectSkillAgents: vi.fn(),
  collectSkillBashPermissions: vi.fn(),
  collectSkillMcps: vi.fn(),
  injectSkillAgentPermissions: vi.fn(),
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

vi.mock("./utils/cache-ctrl-watch.js", () => ({
  startCacheCtrlWatch: vi.fn(),
}));

vi.mock("./utils/content-merge.js", () => ({
  collectDirs: vi.fn(),
}));

const mockResolveConfigBaseDirs = vi.mocked(resolveConfigBaseDirs);
const mockResolveOpencodeConfigDir = vi.mocked(resolveOpencodeConfigDir);
const mockResolveUserConfig = vi.mocked(resolveUserConfig);
const mockCreateHooks = vi.mocked(createHooks);
const mockRegisterAgents = vi.mocked(registerAgents);
const mockRegisterCommands = vi.mocked(registerCommands);
const mockRegisterSkills = vi.mocked(registerSkills);
const mockLoadVendorPrompts = vi.mocked(loadVendorPrompts);
const mockCollectAutoInjectSkills = vi.mocked(collectAutoInjectSkills);
const mockInjectAutoInjectSkills = vi.mocked(injectAutoInjectSkills);
const mockResolveActiveSkills = vi.mocked(resolveActiveSkills);
const mockCollectSkillAgents = vi.mocked(collectSkillAgents);
const mockCollectSkillBashPermissions = vi.mocked(collectSkillBashPermissions);
const mockCollectSkillMcps = vi.mocked(collectSkillMcps);
const mockInjectSkillAgentPermissions = vi.mocked(injectSkillAgentPermissions);
const mockInjectSkillBashPermissions = vi.mocked(injectSkillBashPermissions);
const mockInjectSkillMcpPermissions = vi.mocked(injectSkillMcpPermissions);
const mockMergeSkillMcps = vi.mocked(mergeSkillMcps);
const mockInitLogger = vi.mocked(initLogger);
const mockStartCacheCtrlWatch = vi.mocked(startCacheCtrlWatch);
const mockSetLevel = vi.mocked(logger.setLevel);
const mockCollectDirs = vi.mocked(collectDirs);

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
    });
    mockRegisterSkills.mockReturnValue({ dirs: [] });
    mockCollectSkillAgents.mockReturnValue({});
    mockCollectSkillMcps.mockReturnValue({ mcpMap: {}, skillMcpIndex: {} });
    mockCollectSkillBashPermissions.mockReturnValue({});
    mockCollectAutoInjectSkills.mockReturnValue(new Map());
    mockResolveActiveSkills.mockReturnValue(new Set());
    mockCollectDirs.mockReturnValue(new Map());

    // Act
    const plugin = await LaBriguadePlugin({ directory: "/project" } as never);

    // Assert
    expect(mockInitLogger).toHaveBeenCalledOnce();
    expect(mockStartCacheCtrlWatch).toHaveBeenCalledOnce();
    expect(mockStartCacheCtrlWatch).toHaveBeenCalledWith("/project");
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
      segments: [{ target: "claude" as const, text: "Claude section" }],
    };
    mockRegisterAgents.mockReturnValue({
      agentSections: new Map([["coder", sharedSection]]),
    });
    mockRegisterSkills.mockReturnValue({ dirs: ["/skills/typescript"] });
    mockCollectSkillAgents.mockReturnValue({ typescript: ["coder"] });
    mockCollectSkillMcps.mockReturnValue({ mcpMap: { context7: {} as never }, skillMcpIndex: { coder: [] } });
    mockCollectSkillBashPermissions.mockReturnValue({ coder: { "npm *": "allow" } });
    mockCollectAutoInjectSkills.mockReturnValue(new Map());
    mockResolveActiveSkills.mockReturnValue(new Set());
    const autoInjectDirMap = new Map([
      ["typescript", "/project/.la_briguade/auto-inject-skills/typescript"],
    ]);
    mockCollectDirs.mockReturnValue(autoInjectDirMap);

    let capturedSections: ReadonlyMap<string, AgentSectionsEntry> | undefined;
    mockCreateHooks.mockImplementation((_, agentSections) => {
      capturedSections = agentSections;
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
    expect(mockCollectSkillAgents).toHaveBeenCalledWith(["/skills/typescript"]);
    expect(mockInjectSkillAgentPermissions).toHaveBeenCalledWith(input, {
      typescript: ["coder"],
    });
    expect(mockCollectSkillMcps).toHaveBeenCalledWith(["/skills/typescript"]);
    expect(mockMergeSkillMcps).toHaveBeenCalledWith(input, { context7: {} });
    expect(mockInjectSkillMcpPermissions).toHaveBeenCalledWith(input, { coder: [] });
    expect(mockInjectSkillBashPermissions).toHaveBeenCalledWith(input, {
      coder: { "npm *": "allow" },
    });
    expect(mockCollectAutoInjectSkills).toHaveBeenCalledOnce();
    expect(mockCollectAutoInjectSkills).toHaveBeenCalledWith([
      "/project/.la_briguade/auto-inject-skills/typescript",
    ]);
    expect(mockResolveActiveSkills).toHaveBeenCalledWith(new Map(), "/project");
    expect(mockInjectAutoInjectSkills).toHaveBeenCalledWith(input, new Map(), new Set());
    expect(capturedSections?.get("coder")).toEqual(sharedSection);
  });

  it("should include canonical and legacy project auto-inject roots", async () => {
    // Arrange
    mockResolveConfigBaseDirs.mockReturnValue({ globalDir: "/global", projectDir: "/project" });
    mockResolveOpencodeConfigDir.mockReturnValue("/config/opencode");
    mockResolveUserConfig.mockReturnValue({});
    mockLoadVendorPrompts.mockReturnValue(new Map());
    mockCreateHooks.mockReturnValue({});
    mockRegisterAgents.mockReturnValue({ agentSections: new Map() });
    mockRegisterSkills.mockReturnValue({ dirs: [] });
    mockCollectSkillAgents.mockReturnValue({});
    mockCollectSkillMcps.mockReturnValue({ mcpMap: {}, skillMcpIndex: {} });
    mockCollectSkillBashPermissions.mockReturnValue({});
    const autoInjectEntries = new Map();
    const activeSkills = new Set<string>();
    const autoInjectDirMap = new Map([
      ["typescript", "/project/.la_briguade/auto-inject-skills/typescript"],
      ["legacy", "/project/.la_briguade/skills/typescript"],
    ]);
    mockCollectDirs.mockReturnValue(autoInjectDirMap);
    mockCollectAutoInjectSkills.mockReturnValue(autoInjectEntries);
    mockResolveActiveSkills.mockReturnValue(activeSkills);

    // Act
    const plugin = await LaBriguadePlugin({ directory: "/project" } as never);
    await plugin.config?.({} as never);

    // Assert
    const autoInjectRoots = mockCollectDirs.mock.calls[0]?.[0] ?? [];
    expect(autoInjectRoots).toContain("/project/.la_briguade/skills");
    expect(autoInjectRoots).toContain("/project/.la_briguade/auto-inject-skills");
    expect(autoInjectRoots.indexOf("/project/.la_briguade/skills")).toBeLessThan(
      autoInjectRoots.indexOf("/project/.la_briguade/auto-inject-skills"),
    );

    const autoInjectSkillDirs = mockCollectAutoInjectSkills.mock.calls[0]?.[0] ?? [];
    expect(autoInjectSkillDirs).toContain(
      "/project/.la_briguade/auto-inject-skills/typescript",
    );
    expect(autoInjectSkillDirs).toContain(
      "/project/.la_briguade/skills/typescript",
    );
    expect(mockResolveActiveSkills).toHaveBeenCalledWith(autoInjectEntries, "/project");
    expect(mockInjectAutoInjectSkills).toHaveBeenCalledWith(
      {} as never,
      autoInjectEntries,
      activeSkills,
    );
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
    });
    mockRegisterSkills.mockReturnValue({ dirs: [] });
    mockCollectSkillAgents.mockReturnValue({});
    mockCollectSkillMcps.mockReturnValue({ mcpMap: {}, skillMcpIndex: {} });
    mockCollectSkillBashPermissions.mockReturnValue({});
    mockCollectAutoInjectSkills.mockReturnValue(new Map());
    mockResolveActiveSkills.mockReturnValue(new Set());
    mockCollectDirs.mockReturnValue(new Map());

    // Act
    const plugin = await LaBriguadePlugin({ directory: "/project" } as never);
    await plugin.config?.({} as never);

    // Assert
    expect(mockSetLevel).toHaveBeenCalledWith("warn");
  });
});
