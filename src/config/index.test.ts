import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("node:os");
vi.mock("./loader.js");
vi.mock("../utils/logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import { homedir } from "node:os";
import { loadConfig } from "./loader.js";
import { resolveConfigBaseDirs, resolveUserConfig } from "./index.js";
import type { LaBriguadeConfig } from "./schema.js";
import type { ConfigLoadResult } from "./loader.js";
import { logger } from "../utils/logger.js";

const mockHomedir = vi.mocked(homedir);
const mockLoadConfig = vi.mocked(loadConfig);
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

describe("resolveUserConfig", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should return empty config when both configs are absent", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");
    mockLoadConfig.mockReturnValue(notFoundResult());

    // Act
    const result = resolveUserConfig("/project");

    // Assert
    expect(result).toEqual({});
  });

  it("should return global config when only global config is present", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");
    mockLoadConfig.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return okResult({ model: "anthropic/claude-opus-4" });
      }
      return notFoundResult();
    });

    // Act
    const result = resolveUserConfig("/project");

    // Assert
    expect(result.model).toBe("anthropic/claude-opus-4");
  });

  it("should have project config override global config", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");
    mockLoadConfig.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return okResult({ model: "global-model" });
      }
      if (filePath.includes("/project")) {
        return okResult({ model: "project-model" });
      }
      return notFoundResult();
    });

    // Act
    const result = resolveUserConfig("/project");

    // Assert
    expect(result.model).toBe("project-model");
  });

  it("should override global model with project model", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");
    mockLoadConfig.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return okResult({ model: "global-model", agents: { coder: { temperature: 0.3 } } });
      }
      if (filePath.includes("/project")) {
        return okResult({ model: "project-model" });
      }
      return notFoundResult();
    });

    // Act
    const result = resolveUserConfig("/project");

    // Assert
    expect(result.model).toBe("project-model");
    // Agent from global is still present since project doesn't override it
    expect(result.agents?.["coder"]?.temperature).toBe(0.3);
  });

  it("should merge non-overlapping agents from global and project", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");
    mockLoadConfig.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return okResult({ agents: { coder: { model: "global-coder-model" } } });
      }
      if (filePath.includes("/project")) {
        return okResult({ agents: { reviewer: { temperature: 0.1 } } });
      }
      return notFoundResult();
    });

    // Act
    const result = resolveUserConfig("/project");

    // Assert — both agents present
    expect(result.agents?.["coder"]?.model).toBe("global-coder-model");
    expect(result.agents?.["reviewer"]?.temperature).toBe(0.1);
  });

  it("should warn and skip global config on parse error", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/user");
    mockLoadConfig.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return parseErrorResult("Unexpected token");
      }
      return notFoundResult();
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
    mockLoadConfig.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return notFoundResult();
      }
      return parseErrorResult("Bad JSON");
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
    mockLoadConfig.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return okResult({
          agents: {
            coder: {
              model: "global-model",
              temperature: 0.3,
              systemPromptSuffix: "Use PNPM.",
            },
          },
        });
      }
      if (filePath.includes("/project")) {
        return okResult({
          agents: {
            coder: {
              model: "project-model",
              systemPromptSuffix: "Use tabs.",
            },
          },
        });
      }
      return notFoundResult();
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
    mockLoadConfig.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return okResult({ model: "global-model" });
      }
      if (filePath.includes("/project")) {
        return okResult({ opus_enabled: true });
      }
      return notFoundResult();
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
    mockLoadConfig.mockImplementation((filePath) => {
      if (filePath.includes("la_briguade")) {
        return okResult({ opus_enabled: true, model: "global-model" });
      }
      if (filePath.includes("/project")) {
        return okResult({ agents: { coder: { temperature: 0.5 } } });
      }
      return notFoundResult();
    });

    // Act
    const result = resolveUserConfig("/project");

    // Assert — spread does not reset opus_enabled to undefined when project omits it
    expect(result.opus_enabled).toBe(true);
    expect(result.model).toBe("global-model");
    expect(result.agents?.["coder"]?.temperature).toBe(0.5);
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
