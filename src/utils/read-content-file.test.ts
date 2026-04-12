import { afterEach, describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";

import { readContentFile } from "./read-content-file.js";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

const mockReadFileSync = vi.mocked(readFileSync);

describe("readContentFile", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should return file content on happy path", () => {
    // Arrange
    mockReadFileSync.mockReturnValue("agent body");

    // Act
    const result = readContentFile("/tmp/agent.md", 100, "agent");

    // Assert
    expect(result).toBe("agent body");
  });

  it("should throw a clear error when readFileSync fails", () => {
    // Arrange
    mockReadFileSync.mockImplementation(() => {
      throw Object.assign(new Error("not found"), { code: "ENOENT" });
    });

    // Act
    const act = () => readContentFile("/tmp/missing.md", 100, "agent");

    // Assert
    expect(act).toThrowError("Could not read agent file: /tmp/missing.md");
  });

  it("should throw when file content exceeds maxLength", () => {
    // Arrange
    mockReadFileSync.mockReturnValue("x".repeat(11));

    // Act
    const act = () => readContentFile("/tmp/large.md", 10, "agent");

    // Assert
    expect(act).toThrowError("agent file exceeds size limit: /tmp/large.md");
  });

  it("should succeed when file content length is exactly maxLength", () => {
    // Arrange
    mockReadFileSync.mockReturnValue("x".repeat(10));

    // Act
    const result = readContentFile("/tmp/boundary.md", 10, "agent");

    // Assert
    expect(result).toBe("x".repeat(10));
  });
});
