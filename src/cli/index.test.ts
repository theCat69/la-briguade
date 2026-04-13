import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";

import { resolveOpencodeConfigDir, resolveUserConfig } from "../config/index.js";
import { logger } from "../utils/logger.js";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock("../config/index.js", () => ({
  resolveOpencodeConfigDir: vi.fn(),
  resolveUserConfig: vi.fn(),
}));

vi.mock("../utils/logger.js", () => ({
  logger: {
    getLogFilePath: vi.fn(),
    setLevel: vi.fn(),
  },
}));

const mockSpawnSync = vi.mocked(spawnSync);
const mockExistsSync = vi.mocked(existsSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockResolveOpencodeConfigDir = vi.mocked(resolveOpencodeConfigDir);
const mockResolveUserConfig = vi.mocked(resolveUserConfig);
const mockGetLogFilePath = vi.mocked(logger.getLogFilePath);

const GLOBAL_CONFIG_PATH = "/tmp/opencode/opencode.json";
const PACKAGE_JSON_PATH_SUFFIX = "/package.json";
const EXPECTED_NPM_BIN = process.platform === "win32" ? "npm.cmd" : "npm";

async function runCliCommand(command: "install" | "uninstall" | "doctor" | "update"): Promise<void> {
  vi.resetModules();
  process.argv = ["node", "la-briguade", command];
  await import("./index.js");
}

function configureConfigRead(rawConfig: string): void {
  mockReadFileSync.mockImplementation((filePath) => {
    const path = String(filePath);
    if (path.endsWith(PACKAGE_JSON_PATH_SUFFIX)) {
      return JSON.stringify({ version: "0.2.0" });
    }
    if (path === GLOBAL_CONFIG_PATH) {
      return rawConfig;
    }
    throw new Error(`Unexpected read path: ${path}`);
  });
}

describe("cli install/uninstall/doctor/update commands", () => {
  const originalArgv = [...process.argv];
  const originalExitCode = process.exitCode;
  const originalCwd = process.cwd;

  beforeEach(() => {
    mockReadFileSync.mockImplementation((filePath) => {
      const path = String(filePath);
      if (path.endsWith(PACKAGE_JSON_PATH_SUFFIX)) {
        return JSON.stringify({ version: "0.2.0" });
      }
      if (path === GLOBAL_CONFIG_PATH) {
        return "{}\n";
      }
      throw new Error(`Unexpected read path: ${path}`);
    });
  });

  afterEach(() => {
    process.argv = [...originalArgv];
    process.exitCode = originalExitCode;
    process.cwd = originalCwd;
    vi.doUnmock("la-briguade");
    vi.doUnmock("cache-ctrl");
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it("should add plugin entry on install when missing", async () => {
    // Arrange
    mockResolveOpencodeConfigDir.mockReturnValue("/tmp/opencode");
    mockExistsSync.mockImplementation((path) => String(path) === GLOBAL_CONFIG_PATH);
    mockMkdirSync.mockImplementation(() => undefined);
    configureConfigRead("{\n  \"plugin\": []\n}\n");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockWriteFileSync.mockImplementation(() => undefined);

    // Act
    await runCliCommand("install");

    // Assert
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const written = String(mockWriteFileSync.mock.calls[0]?.[1] ?? "");
    expect(written).toContain("\"la-briguade@latest\"");
    expect(logSpy).toHaveBeenCalledWith(
      `Installed — added \"la-briguade@latest\" to plugin in ${GLOBAL_CONFIG_PATH}`,
    );
    expect(process.exitCode).toBeUndefined();
  });

  it("should report already-installed and skip write on install", async () => {
    // Arrange
    mockResolveOpencodeConfigDir.mockReturnValue("/tmp/opencode");
    mockExistsSync.mockImplementation((path) => String(path) === GLOBAL_CONFIG_PATH);
    mockMkdirSync.mockImplementation(() => undefined);
    configureConfigRead("{\n  \"plugin\": [\"la-briguade@latest\"]\n}\n");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    await runCliCommand("install");

    // Assert
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      'Already installed — "la-briguade@latest" is already in plugin array.',
    );
  });

  it("should set exitCode when install write fails", async () => {
    // Arrange
    mockResolveOpencodeConfigDir.mockReturnValue("/tmp/opencode");
    mockExistsSync.mockImplementation((path) => String(path) === GLOBAL_CONFIG_PATH);
    mockMkdirSync.mockImplementation(() => undefined);
    configureConfigRead("{}\n");
    mockWriteFileSync.mockImplementation(() => {
      throw new Error("disk full");
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    await runCliCommand("install");

    // Assert
    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "[la-briguade] Could not write config file: disk full",
    );
  });

  it("should report not-installed when uninstall finds no config file", async () => {
    // Arrange
    mockResolveOpencodeConfigDir.mockReturnValue("/tmp/opencode");
    mockExistsSync.mockReturnValue(false);
    configureConfigRead("{}\n");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    await runCliCommand("uninstall");

    // Assert
    expect(logSpy).toHaveBeenCalledWith("Not installed — no opencode config file found.");
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("should report not-installed when uninstall finds no plugin array", async () => {
    // Arrange
    mockResolveOpencodeConfigDir.mockReturnValue("/tmp/opencode");
    mockExistsSync.mockImplementation((path) => String(path) === GLOBAL_CONFIG_PATH);
    configureConfigRead("{}\n");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    await runCliCommand("uninstall");

    // Assert
    expect(logSpy).toHaveBeenCalledWith(
      `Not installed — no plugin array in ${GLOBAL_CONFIG_PATH}`,
    );
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("should remove plugin entry on uninstall when present", async () => {
    // Arrange
    mockResolveOpencodeConfigDir.mockReturnValue("/tmp/opencode");
    mockExistsSync.mockImplementation((path) => String(path) === GLOBAL_CONFIG_PATH);
    configureConfigRead(
      "{\n  \"plugin\": [\"another-plugin\", \"la-briguade@latest\"]\n}\n",
    );
    mockWriteFileSync.mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    await runCliCommand("uninstall");

    // Assert
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const written = String(mockWriteFileSync.mock.calls[0]?.[1] ?? "");
    expect(written).toContain("another-plugin");
    expect(written).not.toContain("la-briguade@latest");
    expect(process.exitCode).toBeUndefined();
  });

  it("should set exitCode when uninstall write fails", async () => {
    // Arrange
    mockResolveOpencodeConfigDir.mockReturnValue("/tmp/opencode");
    mockExistsSync.mockImplementation((path) => String(path) === GLOBAL_CONFIG_PATH);
    configureConfigRead("{\n  \"plugin\": [\"la-briguade@latest\"]\n}\n");
    mockWriteFileSync.mockImplementation(() => {
      throw new Error("disk full");
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    await runCliCommand("uninstall");

    // Assert
    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[la-briguade] Could not write config file:"),
    );
  });

  it("should report all checks passed in doctor happy path", async () => {
    // Arrange
    vi.doMock("la-briguade", () => ({}), { virtual: true });
    vi.doMock("cache-ctrl", () => ({}), { virtual: true });
    mockResolveOpencodeConfigDir.mockReturnValue("/tmp/opencode");
    mockResolveUserConfig.mockReturnValue({ log_level: "info" });
    mockGetLogFilePath.mockReturnValue("/tmp/opencode/log/la.log");
    mockExistsSync.mockImplementation((path) => {
      const value = String(path);
      return (
        value === GLOBAL_CONFIG_PATH ||
        value.endsWith("/content") ||
        value.endsWith("/content/agents") ||
        value.endsWith("/content/skills") ||
        value.endsWith("/content/commands")
      );
    });
    configureConfigRead("{\n  \"plugin\": [\"la-briguade@latest\"]\n}\n");
    mockReaddirSync.mockImplementation((dirPath) => {
      const value = String(dirPath);
      if (value.endsWith("/content/agents")) return ["coder.md", "orchestrator.md"] as never;
      if (value.endsWith("/content/commands")) return ["fix.md"] as never;
      if (value.endsWith("/content/skills")) return ["typescript", "frontend"] as never;
      return [] as never;
    });
    mockStatSync.mockImplementation((filePath) => ({
      isDirectory: () => String(filePath).includes("/content/skills/"),
    }) as never);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.cwd = vi.fn(() => "/workspace") as never;

    // Act
    await runCliCommand("doctor");
    await vi.waitFor(() => {
      expect(mockResolveUserConfig.mock.calls.length).toBeGreaterThan(0);
    });

    // Assert
    expect(mockResolveUserConfig).toHaveBeenCalledWith("/workspace");
    expect(process.exitCode).toBeUndefined();
  });

  it("should set exitCode when doctor reports failures", async () => {
    // Arrange
    mockResolveOpencodeConfigDir.mockReturnValue("/tmp/opencode");
    mockResolveUserConfig.mockReturnValue({});
    mockGetLogFilePath.mockReturnValue("not initialized");
    mockExistsSync.mockReturnValue(false);
    configureConfigRead("{}\n");
    mockReaddirSync.mockReturnValue([] as never);
    mockStatSync.mockImplementation(() => ({ isDirectory: () => false }) as never);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    await runCliCommand("doctor");
    await vi.waitFor(() => {
      expect(process.exitCode).toBe(1);
    });

    // Assert
    expect(process.exitCode).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/issue(s)? found\./));
  });

  it("should complete without setting exitCode when npm update succeeds", async () => {
    // Arrange
    process.exitCode = undefined;
    mockSpawnSync.mockReturnValue({ status: 0, signal: null } as never);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    await runCliCommand("update");

    // Assert
    expect(mockSpawnSync).toHaveBeenCalledWith(
      EXPECTED_NPM_BIN,
      ["install", "-g", "la-briguade@latest"],
      expect.objectContaining({ timeout: 120_000 }),
    );
    expect(mockSpawnSync.mock.calls[0]?.[2]).not.toHaveProperty("shell");
    expect(process.exitCode).toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("should set exitCode and print error when npm update exits non-zero", async () => {
    // Arrange
    process.exitCode = undefined;
    mockSpawnSync.mockReturnValue({ status: 1, signal: null } as never);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    await runCliCommand("update");

    // Assert
    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "[la-briguade] Update failed with exit code 1.",
    );
  });

  it("should set exitCode and report error when spawnSync throws", async () => {
    // Arrange
    process.exitCode = undefined;
    mockSpawnSync.mockImplementation(() => {
      throw new Error("spawn failed");
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    await runCliCommand("update");

    // Assert
    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("[la-briguade] Update failed: spawn failed");
  });

  it("should set exitCode and print timeout error when update is terminated", async () => {
    // Arrange
    process.exitCode = undefined;
    mockSpawnSync.mockReturnValue({ status: null, signal: "SIGTERM" } as never);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    await runCliCommand("update");

    // Assert
    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("[la-briguade] Update timed out after 120 seconds.");
  });
});
