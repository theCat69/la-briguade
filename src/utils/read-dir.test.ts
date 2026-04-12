import { afterEach, describe, expect, it, vi } from "vitest";

import { readdirSync } from "node:fs";

import { logger } from "./logger.js";
import { readDirSafe } from "./read-dir.js";

vi.mock("node:fs", () => ({
  readdirSync: vi.fn(),
}));

vi.mock("./logger.js", () => ({
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
      "Could not read agents directory: /restricted",
    );
  });
});
