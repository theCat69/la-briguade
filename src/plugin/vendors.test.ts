import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs");

import { readdirSync, readFileSync } from "node:fs";

import { loadVendorPrompts } from "./vendors.js";

const mockReaddirSync = vi.mocked(readdirSync);
const mockReadFileSync = vi.mocked(readFileSync);

type MockDirent = {
  name: string;
  isFile: () => boolean;
};

function createFileEntry(name: string): MockDirent {
  return {
    name,
    isFile: () => true,
  };
}

function createSymlinkLikeEntry(name: string): MockDirent {
  return {
    name,
    isFile: () => false,
  };
}

describe("loadVendorPrompts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should skip files whose trimmed content exceeds max length", () => {
    // Arrange
    mockReaddirSync.mockReturnValue([createFileEntry("gpt.md")] as never);
    mockReadFileSync.mockReturnValue(` ${"x".repeat(4_001)} ` as never);

    // Act
    const result = loadVendorPrompts("/content");

    // Assert
    expect(result.size).toBe(0);
    expect(result.has("gpt")).toBe(false);
  });

  it("should skip symlink entries by ignoring non-file dirents", () => {
    // Arrange
    mockReaddirSync.mockReturnValue([createSymlinkLikeEntry("claude.md")] as never);

    // Act
    const result = loadVendorPrompts("/content");

    // Assert
    expect(result.size).toBe(0);
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it("should return an empty map when vendor-prompts directory is missing", () => {
    // Arrange
    mockReaddirSync.mockImplementation(() => {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    // Act
    const result = loadVendorPrompts("/content");

    // Assert
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it("should lowercase markdown filename stem for map key", () => {
    // Arrange
    mockReaddirSync.mockReturnValue([createFileEntry("Claude.md")] as never);
    mockReadFileSync.mockReturnValue("  Use Claude policy.  " as never);

    // Act
    const result = loadVendorPrompts("/content");

    // Assert
    expect(result.size).toBe(1);
    expect(result.get("claude")).toBe("Use Claude policy.");
  });

  it("should warn and skip file when readFileSync throws", () => {
    // Arrange
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockReaddirSync.mockReturnValue([createFileEntry("gpt.md")] as never);
    mockReadFileSync.mockImplementation(() => {
      throw new Error("EACCES");
    });

    // Act
    const result = loadVendorPrompts("/content");

    // Assert
    expect(result.has("gpt")).toBe(false);
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});
