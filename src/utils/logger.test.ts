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

  it("should not write file or console when level is off", () => {
    // Arrange
    initLogger();
    logger.setLevel("off");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // Act
    logger.warn("hidden warning");

    // Assert
    expect(warnSpy).not.toHaveBeenCalled();
    expect(mockAppendFileSync).not.toHaveBeenCalled();
  });

  it("should warn to console and file at default warn level", () => {
    // Arrange
    initLogger();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // Act
    logger.warn("something happened");

    // Assert
    expect(warnSpy).toHaveBeenCalledWith("[la-briguade] something happened");
    expect(mockAppendFileSync).toHaveBeenCalledOnce();
    const [pathArg, lineArg] = mockAppendFileSync.mock.calls[0]!;
    expect(String(pathArg)).toContain("/opencode/log/la-briguade-");
    expect(String(lineArg)).toContain("[WARN] something happened");
  });

  it("should not write info at warn level", () => {
    // Arrange
    initLogger();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // Act
    logger.info("informational event");

    // Assert
    expect(warnSpy).not.toHaveBeenCalled();
    expect(mockAppendFileSync).not.toHaveBeenCalled();
  });

  it("should call console.error when level is warn and logger.error is called", () => {
    // Arrange
    initLogger();
    logger.setLevel("warn");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    logger.error("error at warn level");

    // Assert
    expect(errorSpy).toHaveBeenCalledWith("[la-briguade] error at warn level");
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

  it("should error to console and file at error level", () => {
    // Arrange
    initLogger();
    logger.setLevel("error");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    logger.error("fatal event");

    // Assert
    expect(errorSpy).toHaveBeenCalledWith("[la-briguade] fatal event");
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

  it("should clear logFilePath and warn when mkdirSync throws", () => {
    // Arrange
    mockMkdirSync.mockImplementationOnce(() => {
      throw new Error("disk full");
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // Act
    initLogger();

    // Assert
    expect(logger.getLogFilePath()).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "[la-briguade] Could not create log directory: disk full",
    );
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
