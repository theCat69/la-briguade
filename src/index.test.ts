import { describe, expect, it, vi, afterEach } from "vitest";

import LaBriguadePlugin from "./index.js";

import { resolveConfigBaseDirs, resolveOpencodeConfigDir, resolveUserConfig } from "./config/index.js";
import { createHooks } from "./hooks/index.js";
import { registerAgents } from "./plugin/agents.js";
import { registerCommands } from "./plugin/commands.js";
import {
  collectSkillAgents,
  collectSkillBashPermissions,
  collectSkillExternalDirectories,
  collectSkillMcps,
  injectSkillAgentPermissions,
  injectSkillBashPermissions,
  injectSkillExternalDirectoryPermissions,
  injectSkillMcpPermissions,
  mergeSkillMcps,
} from "./plugin/mcp/index.js";
import { registerSkills } from "./plugin/skills.js";
import { createSidekickAgentTool } from "./plugin/sidekick-agent.js";
import {
  collectAutoInjectSkills,
  injectAutoInjectSkills,
  resolveActiveSkills,
} from "./plugin/auto-inject.js";
import { collectDirs } from "./utils/content/content-merge.js";
import { initLogger, logger } from "./utils/runtime/logger.js";

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

vi.mock("./plugin/sidekick-agent.js", () => ({
  createSidekickAgentTool: vi.fn(),
}));

vi.mock("./plugin/auto-inject.js", () => ({
  collectAutoInjectSkills: vi.fn(),
  injectAutoInjectSkills: vi.fn(),
  resolveActiveSkills: vi.fn(),
}));

vi.mock("./plugin/mcp/index.js", () => ({
  collectSkillAgents: vi.fn(),
  collectSkillBashPermissions: vi.fn(),
  collectSkillExternalDirectories: vi.fn(),
  collectSkillMcps: vi.fn(),
  injectSkillAgentPermissions: vi.fn(),
  injectSkillBashPermissions: vi.fn(),
  injectSkillExternalDirectoryPermissions: vi.fn(),
  injectSkillMcpPermissions: vi.fn(),
  mergeSkillMcps: vi.fn(),
}));

vi.mock("./utils/runtime/logger.js", () => ({
  initLogger: vi.fn(),
  logger: {
    debug: vi.fn(),
    setLevel: vi.fn(),
  },
}));

vi.mock("./utils/content/content-merge.js", () => ({
  collectDirs: vi.fn(),
}));

const mockResolveConfigBaseDirs = vi.mocked(resolveConfigBaseDirs);
const mockResolveOpencodeConfigDir = vi.mocked(resolveOpencodeConfigDir);
const mockResolveUserConfig = vi.mocked(resolveUserConfig);
const mockCreateHooks = vi.mocked(createHooks);
const mockRegisterAgents = vi.mocked(registerAgents);
const mockRegisterCommands = vi.mocked(registerCommands);
const mockRegisterSkills = vi.mocked(registerSkills);
const mockCreateSidekickAgentTool = vi.mocked(createSidekickAgentTool);
const mockCollectAutoInjectSkills = vi.mocked(collectAutoInjectSkills);
const mockInjectAutoInjectSkills = vi.mocked(injectAutoInjectSkills);
const mockResolveActiveSkills = vi.mocked(resolveActiveSkills);
const mockCollectSkillAgents = vi.mocked(collectSkillAgents);
const mockCollectSkillBashPermissions = vi.mocked(collectSkillBashPermissions);
const mockCollectSkillExternalDirectories = vi.mocked(collectSkillExternalDirectories);
const mockCollectSkillMcps = vi.mocked(collectSkillMcps);
const mockInjectSkillAgentPermissions = vi.mocked(injectSkillAgentPermissions);
const mockInjectSkillBashPermissions = vi.mocked(injectSkillBashPermissions);
const mockInjectSkillExternalDirectoryPermissions = vi.mocked(
  injectSkillExternalDirectoryPermissions,
);
const mockInjectSkillMcpPermissions = vi.mocked(injectSkillMcpPermissions);
const mockMergeSkillMcps = vi.mocked(mergeSkillMcps);
const mockInitLogger = vi.mocked(initLogger);
const mockSetLevel = vi.mocked(logger.setLevel);
const mockDebug = vi.mocked(logger.debug);
const mockCollectDirs = vi.mocked(collectDirs);

describe("LaBriguadePlugin", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should initialize logger and expose hooks from createHooks", async () => {
    mockResolveConfigBaseDirs.mockReturnValue({ globalDir: "/global", projectDir: "/project" });
    mockResolveOpencodeConfigDir.mockReturnValue("/config/opencode");
    const eventHook = vi.fn();
    const sidekickTool = vi.fn();
    mockCreateHooks.mockReturnValue({ event: eventHook });
    mockCreateSidekickAgentTool.mockReturnValue(sidekickTool as never);

    const plugin = await LaBriguadePlugin({ directory: "/project" } as never);

    expect(mockInitLogger).toHaveBeenCalledOnce();
    expect(mockCreateHooks).toHaveBeenCalledOnce();
    expect(mockCreateHooks).toHaveBeenCalledWith({ directory: "/project" });
    expect(plugin.event).toBe(eventHook);
    expect(plugin.tool?.["sidekick-agent"]).toBe(sidekickTool);
    expect(plugin.tool?.["sidekick-reviewer"]).toBeUndefined();
    expect(typeof plugin.config).toBe("function");
  });

  it("should wire config callback and populate plugin config", async () => {
    mockResolveConfigBaseDirs.mockReturnValue({ globalDir: "/global", projectDir: "/project" });
    mockResolveOpencodeConfigDir.mockReturnValue("/config/opencode");
    mockResolveUserConfig.mockReturnValue({ log_level: "info" });
    mockCreateHooks.mockReturnValue({ event: vi.fn() });
    mockRegisterSkills.mockReturnValue({ dirs: ["/skills/typescript"] });
    mockCollectSkillAgents.mockReturnValue({ typescript: ["coder"] });
    mockCollectSkillExternalDirectories.mockReturnValue({ typescript: "/skills/typescript" });
    mockCollectSkillMcps.mockReturnValue({ mcpMap: { context7: {} as never }, skillMcpIndex: { coder: [] } });
    mockCollectSkillBashPermissions.mockReturnValue({ coder: { "npm *": "allow" } });
    const autoInjectEntries = new Map();
    const activeSkills = new Set<string>();
    mockCollectDirs.mockReturnValue(
      new Map([["typescript", "/project/.la_briguade/auto-inject-skills/typescript"]]),
    );
    mockCollectAutoInjectSkills.mockReturnValue(autoInjectEntries);
    mockResolveActiveSkills.mockReturnValue(activeSkills);

    const plugin = await LaBriguadePlugin({ directory: "/project" } as never);
    const input = {} as never;
    await plugin.config?.(input);

    expect(mockSetLevel).toHaveBeenCalledWith("info");
    expect(mockRegisterAgents).toHaveBeenCalledWith(
      input,
      [
        expect.stringMatching(/\/content\/agents$/),
        "/global/agents",
        "/project/.la_briguade/agents",
      ],
      { log_level: "info" },
    );
    expect(mockRegisterCommands).toHaveBeenCalledWith(
      input,
      [
        expect.stringMatching(/\/content\/commands$/),
        "/global/commands",
        "/project/.la_briguade/commands",
      ],
      { log_level: "info" },
    );
    expect(mockRegisterSkills).toHaveBeenCalledWith(input, [
      expect.stringMatching(/\/content\/skills$/),
      "/config/opencode/skills",
      "/global/skills",
      "/project/.opencode/skills",
      "/project/.la_briguade/skills",
    ]);
    expect(mockCollectSkillAgents).toHaveBeenCalledWith(["/skills/typescript"]);
    expect(mockInjectSkillAgentPermissions).toHaveBeenCalledWith(input, { typescript: ["coder"] });
    expect(mockCollectSkillExternalDirectories).toHaveBeenCalledWith(["/skills/typescript"]);
    expect(mockInjectSkillExternalDirectoryPermissions).toHaveBeenCalledWith(input, {
      typescript: "/skills/typescript",
    });
    expect(mockCollectSkillMcps).toHaveBeenCalledWith(["/skills/typescript"]);
    expect(mockMergeSkillMcps).toHaveBeenCalledWith(input, { context7: {} });
    expect(mockInjectSkillMcpPermissions).toHaveBeenCalledWith(input, { coder: [] });
    expect(mockCollectSkillBashPermissions).toHaveBeenCalledWith(["/skills/typescript"]);
    expect(mockInjectSkillBashPermissions).toHaveBeenCalledWith(input, {
      coder: { "npm *": "allow" },
    });
    expect(mockCollectDirs).toHaveBeenCalledWith([
      expect.stringMatching(/\/content\/auto-inject-skills$/),
      "/global/auto-inject-skills",
      "/project/.la_briguade/auto-inject-skills",
    ]);
    expect(mockCollectAutoInjectSkills).toHaveBeenCalledWith([
      "/project/.la_briguade/auto-inject-skills/typescript",
    ]);
    expect(mockResolveActiveSkills).toHaveBeenCalledWith(autoInjectEntries, "/project");
    expect(mockInjectAutoInjectSkills).toHaveBeenCalledWith(input, autoInjectEntries, activeSkills);
  });

  it("should log the final build agent prompt with an approximate token count", async () => {
    mockResolveConfigBaseDirs.mockReturnValue({ globalDir: "/global", projectDir: "/project" });
    mockResolveOpencodeConfigDir.mockReturnValue("/config/opencode");
    mockResolveUserConfig.mockReturnValue({ log_level: "debug" });
    mockCreateHooks.mockReturnValue({});
    mockRegisterSkills.mockReturnValue({ dirs: [] });
    mockCollectSkillAgents.mockReturnValue({});
    mockCollectSkillExternalDirectories.mockReturnValue({});
    mockCollectSkillMcps.mockReturnValue({ mcpMap: {}, skillMcpIndex: {} });
    mockCollectSkillBashPermissions.mockReturnValue({});
    mockCollectDirs.mockReturnValue(new Map());
    mockCollectAutoInjectSkills.mockReturnValue(new Map());
    mockResolveActiveSkills.mockReturnValue(new Set());
    mockInjectAutoInjectSkills.mockImplementation((input) => {
      input.agent = { builder: { prompt: "Base\nInjected" } };
    });

    const plugin = await LaBriguadePlugin({ directory: "/project" } as never);
    await plugin.config?.({} as never);

    expect(mockDebug).toHaveBeenCalledWith(
      'Build agent system prompt (4 approximate tokens; 4 characters/token): "Base\\nInjected"',
    );
  });

  it("should include only canonical project auto-inject root", async () => {
    mockResolveConfigBaseDirs.mockReturnValue({ globalDir: "/global", projectDir: "/project" });
    mockResolveOpencodeConfigDir.mockReturnValue("/config/opencode");
    mockResolveUserConfig.mockReturnValue({});
    mockCreateHooks.mockReturnValue({});
    mockRegisterSkills.mockReturnValue({ dirs: [] });
    mockCollectSkillAgents.mockReturnValue({});
    mockCollectSkillExternalDirectories.mockReturnValue({});
    mockCollectSkillMcps.mockReturnValue({ mcpMap: {}, skillMcpIndex: {} });
    mockCollectSkillBashPermissions.mockReturnValue({});
    const autoInjectEntries = new Map();
    const activeSkills = new Set<string>();
    mockCollectDirs.mockReturnValue(
      new Map([["typescript", "/project/.la_briguade/auto-inject-skills/typescript"]]),
    );
    mockCollectAutoInjectSkills.mockReturnValue(autoInjectEntries);
    mockResolveActiveSkills.mockReturnValue(activeSkills);

    const plugin = await LaBriguadePlugin({ directory: "/project" } as never);
    await plugin.config?.({} as never);

    const autoInjectRoots = mockCollectDirs.mock.calls[0]?.[0] ?? [];
    expect(autoInjectRoots).toContain("/project/.la_briguade/auto-inject-skills");
    expect(autoInjectRoots).toContain("/global/auto-inject-skills");
    expect(autoInjectRoots).not.toContain("/config/opencode/skills");
    expect(autoInjectRoots).not.toContain("/global/skills");
    expect(autoInjectRoots).not.toContain("/project/.opencode/skills");
    expect(autoInjectRoots).not.toContain("/project/.la_briguade/skills");

    const autoInjectSkillDirs = mockCollectAutoInjectSkills.mock.calls[0]?.[0] ?? [];
    expect(autoInjectSkillDirs).toContain("/project/.la_briguade/auto-inject-skills/typescript");
    expect(autoInjectSkillDirs).not.toContain("/project/.la_briguade/skills/typescript");
    expect(mockResolveActiveSkills).toHaveBeenCalledWith(autoInjectEntries, "/project");
    expect(mockInjectAutoInjectSkills).toHaveBeenCalledWith(
      {} as never,
      autoInjectEntries,
      activeSkills,
    );
  });

  it('should default logger level to "warn" when log_level is missing', async () => {
    mockResolveConfigBaseDirs.mockReturnValue({ globalDir: "/global", projectDir: "/project" });
    mockResolveOpencodeConfigDir.mockReturnValue("/config/opencode");
    mockResolveUserConfig.mockReturnValue({});
    mockCreateHooks.mockReturnValue({});
    mockRegisterSkills.mockReturnValue({ dirs: [] });
    mockCollectSkillAgents.mockReturnValue({});
    mockCollectSkillExternalDirectories.mockReturnValue({});
    mockCollectSkillMcps.mockReturnValue({ mcpMap: {}, skillMcpIndex: {} });
    mockCollectSkillBashPermissions.mockReturnValue({});
    mockCollectDirs.mockReturnValue(new Map());
    mockCollectAutoInjectSkills.mockReturnValue(new Map());
    mockResolveActiveSkills.mockReturnValue(new Set());

    const plugin = await LaBriguadePlugin({ directory: "/project" } as never);
    await plugin.config?.({} as never);

    expect(mockSetLevel).toHaveBeenCalledWith("warn");
  });
});
