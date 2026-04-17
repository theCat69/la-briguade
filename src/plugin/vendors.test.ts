import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs");
vi.mock("../utils/content/content-merge.js");

import { readFileSync } from "node:fs";

import { loadVendorPrompts } from "./vendors.js";
import { collectFiles } from "../utils/content/content-merge.js";
import { logger } from "../utils/runtime/logger.js";

const mockReadFileSync = vi.mocked(readFileSync);
const mockCollectFiles = vi.mocked(collectFiles);

describe("loadVendorPrompts", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should skip files whose trimmed content exceeds max length", () => {
    // Arrange
    mockCollectFiles.mockReturnValue(new Map([["gpt", "/content/vendor-prompts/gpt.md"]]));
    mockReadFileSync.mockReturnValue(` ${"x".repeat(4_001)} ` as never);

    // Act
    const result = loadVendorPrompts(["/content/vendor-prompts"]);

    // Assert
    expect(result.size).toBe(0);
    expect(result.has("gpt")).toBe(false);
  });

  it("should accept file whose trimmed content equals max length", () => {
    // Arrange
    mockCollectFiles.mockReturnValue(new Map([["gpt", "/content/vendor-prompts/gpt.md"]]));
    mockReadFileSync.mockReturnValue("x".repeat(4_000) as never);

    // Act
    const result = loadVendorPrompts(["/content/vendor-prompts"]);

    // Assert
    expect(result.size).toBe(1);
    expect(result.get("gpt")).toBe("x".repeat(4_000));
  });

  it("should return an empty map when vendor-prompts directory is missing", () => {
    // Arrange
    mockCollectFiles.mockReturnValue(new Map());

    // Act
    const result = loadVendorPrompts(["/content/vendor-prompts"]);

    // Assert
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it("should lowercase markdown filename stem for map key", () => {
    // Arrange
    mockCollectFiles.mockReturnValue(new Map([["Claude", "/content/vendor-prompts/Claude.md"]]));
    mockReadFileSync.mockReturnValue("  Use Claude policy.  " as never);

    // Act
    const result = loadVendorPrompts(["/content/vendor-prompts"]);

    // Assert
    expect(result.size).toBe(1);
    expect(result.get("claude")).toBe("Use Claude policy.");
  });

  it("should warn and skip file when readFileSync throws", () => {
    // Arrange
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    mockCollectFiles.mockReturnValue(new Map([["gpt", "/content/vendor-prompts/gpt.md"]]));
    mockReadFileSync.mockImplementation(() => {
      throw new Error("EACCES");
    });

    // Act
    const result = loadVendorPrompts(["/content/vendor-prompts"]);

    // Assert
    expect(result.has("gpt")).toBe(false);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("should keep file from later directory when stems overlap", () => {
    // Arrange
    mockCollectFiles.mockReturnValue(
      new Map([["claude", "/project/content/vendor-prompts/claude.md"]]),
    );
    mockReadFileSync.mockReturnValue(" Project override prompt " as never);

    // Act
    const result = loadVendorPrompts([
      "/builtin/content/vendor-prompts",
      "/project/content/vendor-prompts",
    ]);

    // Assert
    expect(result.get("claude")).toBe("Project override prompt");
  });
});
