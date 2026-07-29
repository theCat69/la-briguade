import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("node:os");
vi.mock("./loader.js");
vi.mock("../utils/runtime/logger.js", () => ({
  LOG_LEVELS: ["off", "error", "warn", "info", "debug"] as const,
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

import { homedir } from "node:os";
import { inspectConfigLoad } from "./loader.js";
import {
  resolveConfigBaseDirs,
  resolveLaBriguadeConfigDir,
  resolveOpencodeConfigDir,
  resolveUserConfig,
  resolveUserConfigDetails,
} from "./index.js";
import type { LaBriguadeConfig } from "./schema.js";
import type { ConfigLoadResult } from "./loader.js";
import { logger } from "../utils/runtime/logger.js";

const mockHomedir = vi.mocked(homedir);
const mockInspectConfigLoad = vi.mocked(inspectConfigLoad);
const mockLoggerWarn = vi.mocked(logger.warn);

function okResult(value: LaBriguadeConfig): ConfigLoadResult {
  return { ok: true, value };
}

function notFoundResult(): ConfigLoadResult {
  return { ok: false, error: { kind: "not-found" } };
}

function parseErrorResult(message: string): ConfigLoadResult {
  return { ok: false, error: { kind: "parse-error", message } };
}

function inspection(result: ConfigLoadResult, resolvedPath?: string) {
  return {
    searchedPaths: ["/unused.json", "/unused.jsonc"] as [string, string],
    resolvedPath,
    result,
  };
}

describe("resolveUserConfig", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should return empty config when both configs are absent", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");
    mockInspectConfigLoad.mockReturnValue(inspection(notFoundResult()));

    // Act
    const result = resolveUserConfig("/project");

    // Assert
    expect(result).toEqual({});
  });

  it("should return global config when only global config is present", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");
    mockInspectConfigLoad.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return inspection(
          okResult({ model: "anthropic/claude-opus-4" }),
          "/home/user/.config/la_briguade/la-briguade.json",
        );
      }
      return inspection(notFoundResult());
    });

    // Act
    const result = resolveUserConfig("/project");

    // Assert
    expect(result.model).toBe("anthropic/claude-opus-4");
  });

  it("should have project config override global config", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");
    mockInspectConfigLoad.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return inspection(
          okResult({ model: "global-model" }),
          "/home/user/.config/la_briguade/la-briguade.json",
        );
      }
      if (filePath.includes("/project")) {
        return inspection(okResult({ model: "project-model" }), "/project/la-briguade.json");
      }
      return inspection(notFoundResult());
    });

    // Act
    const result = resolveUserConfig("/project");

    // Assert
    expect(result.model).toBe("project-model");
  });

  it("should preserve global agent fields when project overrides top-level model", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");
    mockInspectConfigLoad.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return inspection(
          okResult({ model: "global-model", agents: { coder: { temperature: 0.3 } } }),
          "/home/user/.config/la_briguade/la-briguade.json",
        );
      }
      if (filePath.includes("/project")) {
        return inspection(okResult({ model: "project-model" }), "/project/la-briguade.json");
      }
      return inspection(notFoundResult());
    });

    // Act
    const result = resolveUserConfig("/project");

    // Assert
    expect(result.model).toBe("project-model");
    // Agent from global is still present since project doesn't override it
    expect(result.agents?.["coder"]?.temperature).toBe(0.3);
  });

  it("should return project config as-is when global config is absent", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");
    const projectConfig: LaBriguadeConfig = {
      model: "project-model",
      agents: { coder: { temperature: 0.7 } },
    };
    mockInspectConfigLoad.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return inspection(notFoundResult());
      }
      if (filePath.includes("/project")) {
        return inspection(okResult(projectConfig), "/project/la-briguade.json");
      }
      return inspection(notFoundResult());
    });

    // Act
    const result = resolveUserConfig("/project");

    // Assert
    expect(result).toEqual(projectConfig);
  });

  it("should merge non-overlapping agents from global and project", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");
    mockInspectConfigLoad.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return inspection(
          okResult({ agents: { coder: { model: "global-coder-model" } } }),
          "/home/user/.config/la_briguade/la-briguade.json",
        );
      }
      if (filePath.includes("/project")) {
        return inspection(
          okResult({ agents: { "sidekick-reviewer": { temperature: 0.1 } } }),
          "/project/la-briguade.json",
        );
      }
      return inspection(notFoundResult());
    });

    // Act
    const result = resolveUserConfig("/project");

    // Assert — both agents present
    expect(result.agents?.["coder"]?.model).toBe("global-coder-model");
    expect(result.agents?.["sidekick-reviewer"]?.temperature).toBe(0.1);
  });

  it("should warn and skip global config on parse error", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");
    mockInspectConfigLoad.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return inspection(
          parseErrorResult("Unexpected token"),
          "/home/user/.config/la_briguade/la-briguade.json",
        );
      }
      return inspection(notFoundResult());
    });

    // Act
    const result = resolveUserConfig("/project");

    // Assert
    expect(result).toEqual({});
    expect(mockLoggerWarn).toHaveBeenCalledWith(expect.stringContaining("Global config error:"));
  });

  it("should warn and skip project config on parse error", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");
    mockInspectConfigLoad.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return inspection(notFoundResult());
      }
      return inspection(parseErrorResult("Bad JSON"), "/project/la-briguade.json");
    });

    // Act
    const result = resolveUserConfig("/project");

    // Assert
    expect(result).toEqual({});
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining("Project config error:"),
    );
  });

  it("should deep-merge overlapping agents: project wins conflicts, global fields preserved", () => {
    // Arrange — both global and project define overrides for "coder"
    mockHomedir.mockReturnValue("/home/user");
    mockInspectConfigLoad.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return inspection(
          okResult({
            agents: {
              coder: {
                model: "global-model",
                temperature: 0.3,
                systemPromptSuffix: "Use PNPM.",
              },
            },
          }),
          "/home/user/.config/la_briguade/la-briguade.json",
        );
      }
      if (filePath.includes("/project")) {
        return inspection(
          okResult({
            agents: {
              coder: {
                model: "project-model",
                systemPromptSuffix: "Use tabs.",
              },
            },
          }),
          "/project/la-briguade.json",
        );
      }
      return inspection(notFoundResult());
    });

    // Act
    const result = resolveUserConfig("/project");
    const coder = result.agents?.["coder"];

    // Assert — project model wins
    expect(coder?.model).toBe("project-model");
    // Global-only field is preserved
    expect(coder?.temperature).toBe(0.3);
    // systemPromptSuffix is chained: global first, then project
    expect(coder?.systemPromptSuffix).toBe("Use PNPM.\n\nUse tabs.");
  });

  it("should carry project opus_enabled: true through to merged config", () => {
    // Arrange — global has no opus_enabled, project sets it to true
    mockHomedir.mockReturnValue("/home/user");
    mockInspectConfigLoad.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return inspection(
          okResult({ model: "global-model" }),
          "/home/user/.config/la_briguade/la-briguade.json",
        );
      }
      if (filePath.includes("/project")) {
        return inspection(okResult({ opus_enabled: true }), "/project/la-briguade.json");
      }
      return inspection(notFoundResult());
    });

    // Act
    const result = resolveUserConfig("/project");

    // Assert — project opus_enabled: true is present in merged result
    expect(result.opus_enabled).toBe(true);
    // Global model is still inherited
    expect(result.model).toBe("global-model");
  });

  it("should preserve global opus_enabled: true when project config omits it", () => {
    // Arrange — global sets opus_enabled: true, project omits the field entirely
    mockHomedir.mockReturnValue("/home/user");
    mockInspectConfigLoad.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return inspection(
          okResult({ opus_enabled: true, model: "global-model" }),
          "/home/user/.config/la_briguade/la-briguade.json",
        );
      }
      if (filePath.includes("/project")) {
        return inspection(
          okResult({ agents: { coder: { temperature: 0.5 } } }),
          "/project/la-briguade.json",
        );
      }
      return inspection(notFoundResult());
    });

    // Act
    const result = resolveUserConfig("/project");

    // Assert — spread does not reset opus_enabled to undefined when project omits it
    expect(result.opus_enabled).toBe(true);
    expect(result.model).toBe("global-model");
    expect(result.agents?.["coder"]?.temperature).toBe(0.5);
  });

  it("should expose merged config details with source metadata", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");
    mockInspectConfigLoad.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return inspection(
          okResult({ model: "global-model" }),
          "/home/user/.config/la_briguade/la-briguade.json",
        );
      }

      return inspection(
        okResult({ agents: { "sidekick-reviewer": { model: "project-model" } } }),
        "/project/la-briguade.json",
      );
    });

    // Act
    const result = resolveUserConfigDetails("/project");

    // Assert
    expect(result.source).toBe("merged");
    expect(result.global.resolvedPath).toBe("/home/user/.config/la_briguade/la-briguade.json");
    expect(result.project.resolvedPath).toBe("/project/la-briguade.json");
    expect(result.config.model).toBe("global-model");
    expect(result.config.agents?.["sidekick-reviewer"]?.model).toBe("project-model");
  });
});

describe("resolveLaBriguadeConfigDir", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should resolve to homedir/.config/la_briguade", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");

    // Act
    const result = resolveLaBriguadeConfigDir();

    // Assert
    expect(result).toBe("/home/user/.config/la_briguade");
  });
});

describe("resolveConfigBaseDirs", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should resolve global and project base directories", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");

    // Act
    const result = resolveConfigBaseDirs("/project");

    // Assert
    expect(result).toEqual({
      globalDir: "/home/user/la_briguade",
      projectDir: "/project",
    });
  });
});

describe("resolveOpencodeConfigDir", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should resolve to homedir/.config/opencode", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");

    // Act
    const result = resolveOpencodeConfigDir();

    // Assert
    expect(result).toBe("/home/user/.config/opencode");
  });
});
