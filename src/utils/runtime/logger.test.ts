import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  appendFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));
vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/home/test"),
}));

import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";

import { initLogger, logger, resetLogger } from "./logger.js";

const mockAppendFileSync = vi.mocked(appendFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockHomedir = vi.mocked(homedir);

describe("logger", () => {
  afterEach(() => {
    resetLogger();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should not write to log file when level is off", () => {
    // Arrange
    initLogger();
    logger.setLevel("off");

    // Act
    logger.warn("hidden warning");

    // Assert
    expect(mockAppendFileSync).not.toHaveBeenCalled();
  });

  it("should write warn to file at default warn level", () => {
    // Arrange
    initLogger();

    // Act
    logger.warn("something happened");

    // Assert
    expect(mockAppendFileSync).toHaveBeenCalledOnce();
    const [pathArg, lineArg] = mockAppendFileSync.mock.calls[0]!;
    expect(String(pathArg)).toContain("/opencode/log/la-briguade-");
    expect(String(lineArg)).toContain("[WARN] something happened");
  });

  it("should not write info at warn level", () => {
    // Arrange
    initLogger();

    // Act
    logger.info("informational event");

    // Assert
    expect(mockAppendFileSync).not.toHaveBeenCalled();
  });

  it("should write error to file at warn level", () => {
    // Arrange
    initLogger();
    logger.setLevel("warn");

    // Act
    logger.error("error at warn level");

    // Assert
    expect(mockAppendFileSync).toHaveBeenCalledOnce();
  });

  it("should write debug to file at debug level", () => {
    // Arrange
    initLogger();
    logger.setLevel("debug");

    // Act
    logger.debug("trace line");

    // Assert
    expect(mockAppendFileSync).toHaveBeenCalledOnce();
    const [, lineArg] = mockAppendFileSync.mock.calls[0]!;
    expect(String(lineArg)).toContain("[DEBUG] trace line");
  });

  it("should write error to file at error level", () => {
    // Arrange
    initLogger();
    logger.setLevel("error");

    // Act
    logger.error("fatal event");

    // Assert
    expect(mockAppendFileSync).toHaveBeenCalledOnce();
  });

  it("should update behavior dynamically when setLevel changes", () => {
    // Arrange
    initLogger();
    logger.setLevel("error");

    // Act
    logger.warn("blocked");
    logger.setLevel("warn");
    logger.warn("allowed");

    // Assert
    expect(mockAppendFileSync).toHaveBeenCalledTimes(1);
    const [, lineArg] = mockAppendFileSync.mock.calls[0]!;
    expect(String(lineArg)).toContain("[WARN] allowed");
  });

  it("should clear logger state on resetLogger", () => {
    // Arrange
    initLogger();
    const firstPath = logger.getLogFilePath();

    // Act
    resetLogger();

    // Assert
    expect(firstPath).toBeDefined();
    expect(logger.getLogFilePath()).toBeUndefined();
  });

  it("should initialize log directory and file path", () => {
    // Act
    initLogger();

    // Assert
    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining("/.local/share/opencode/log"), {
      recursive: true,
    });
    expect(logger.getLogFilePath()).toContain("/.local/share/opencode/log/");
  });

  it("should clear logFilePath silently when mkdirSync throws", () => {
    // Arrange
    mockMkdirSync.mockImplementationOnce(() => {
      throw new Error("disk full");
    });
    // Act
    initLogger();

    // Assert
    expect(logger.getLogFilePath()).toBeUndefined();
  });

  it("should use XDG_DATA_HOME when available", () => {
    // Arrange
    mockHomedir.mockReturnValue("/home/fallback");
    vi.stubEnv("XDG_DATA_HOME", "/xdg/data");

    // Act
    initLogger();

    // Assert
    expect(mockMkdirSync).toHaveBeenCalledWith("/xdg/data/opencode/log", { recursive: true });
    expect(logger.getLogFilePath()).toContain("/xdg/data/opencode/log/");
  });

  it("should create log filename with la-briguade timestamp format", () => {
    // Act
    initLogger();

    // Assert
    const logPath = logger.getLogFilePath();
    expect(logPath).toBeDefined();
    expect(logPath).toMatch(/\/la-briguade-\d{4}-\d{2}-\d{2}T\d{6}\.log$/);
  });
});
