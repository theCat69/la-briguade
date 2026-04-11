import { describe, expect, it, vi } from "vitest";

import { collectFiles } from "./content-merge.js";
import { logger } from "./logger.js";
import { loadContentFiles } from "./load-content.js";

vi.mock("./content-merge.js");
vi.mock("./logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const mockCollectFiles = vi.mocked(collectFiles);
const mockLoggerWarn = vi.mocked(logger.warn);

describe("loadContentFiles", () => {
  it("should load parsed values keyed by stem", () => {
    mockCollectFiles.mockReturnValue(new Map([["coder", "/tmp/coder.md"]]));

    const loaded = loadContentFiles(["/tmp"], ".md", (_filePath, stem) => `${stem}-ok`);

    expect(loaded).toEqual(new Map([["coder", "coder-ok"]]));
  });

  it("should warn and skip parse undefined results", () => {
    mockCollectFiles.mockReturnValue(new Map([["bad", "/tmp/bad.md"]]));

    const loaded = loadContentFiles(["/tmp"], ".md", () => undefined);

    expect(loaded.size).toBe(0);
    expect(mockLoggerWarn).toHaveBeenCalledWith("skipping /tmp/bad.md: parse returned undefined");
  });

  it("should warn and skip thrown parser errors", () => {
    mockCollectFiles.mockReturnValue(new Map([["bad", "/tmp/bad.md"]]));

    const loaded = loadContentFiles(["/tmp"], ".md", () => {
      throw new Error("boom");
    });

    expect(loaded.size).toBe(0);
    expect(mockLoggerWarn).toHaveBeenCalledWith("skipping /tmp/bad.md: boom");
  });
});
