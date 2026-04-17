import { afterEach, describe, expect, it, vi } from "vitest";

import { readdirSync } from "node:fs";

import { logger } from "../runtime/logger.js";
import { readDirSafe } from "./read-dir.js";

vi.mock("node:fs", () => ({
  readdirSync: vi.fn(),
}));

vi.mock("../runtime/logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const mockReaddirSync = vi.mocked(readdirSync);
const mockLoggerWarn = vi.mocked(logger.warn);

describe("readDirSafe", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should return directory entries on happy path", () => {
    // Arrange
    mockReaddirSync.mockReturnValue(["a.md", "b.md"] as unknown as ReturnType<typeof readdirSync>);

    // Act
    const result = readDirSafe("/content/agents", "agents");

    // Assert
    expect(result).toEqual(["a.md", "b.md"]);
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it("should return undefined without warning on ENOENT", () => {
    // Arrange
    mockReaddirSync.mockImplementation(() => {
      throw Object.assign(new Error("not found"), { code: "ENOENT" });
    });

    // Act
    const result = readDirSafe("/missing", "agents");

    // Assert
    expect(result).toBeUndefined();
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it("should warn and return undefined on non-Error throw", () => {
    // Arrange
    mockReaddirSync.mockImplementation(() => {
      throw "boom";
    });

    // Act
    const result = readDirSafe("/weird", "agents");

    // Assert
    expect(result).toBeUndefined();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Could not read agents directory (UNKNOWN): /weird",
    );
  });

  it("should return undefined and warn on non-ENOENT readdir error", () => {
    // Arrange
    mockReaddirSync.mockImplementation(() => {
      throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    });

    // Act
    const result = readDirSafe("/restricted", "agents");

    // Assert
    expect(result).toBeUndefined();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Could not read agents directory (EACCES): /restricted",
    );
  });
});
