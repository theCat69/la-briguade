import { describe, expect, it, vi } from "vitest";

import { collectFiles } from "./content-merge.js";
import { loadContentFiles } from "./load-content.js";

vi.mock("./content-merge.js");

const mockCollectFiles = vi.mocked(collectFiles);

describe("loadContentFiles", () => {
  it("should load parsed values keyed by stem", () => {
    mockCollectFiles.mockReturnValue(new Map([["coder", "/tmp/coder.md"]]));

    const loaded = loadContentFiles(["/tmp"], ".md", (_filePath, stem) => `${stem}-ok`);

    expect(loaded).toEqual(new Map([["coder", "coder-ok"]]));
  });

  it("should warn and skip parse undefined results", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockCollectFiles.mockReturnValue(new Map([["bad", "/tmp/bad.md"]]));

    const loaded = loadContentFiles(["/tmp"], ".md", () => undefined);

    expect(loaded.size).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      "[la-briguade] skipping /tmp/bad.md: parse returned undefined",
    );
  });

  it("should warn and skip thrown parser errors", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockCollectFiles.mockReturnValue(new Map([["bad", "/tmp/bad.md"]]));

    const loaded = loadContentFiles(["/tmp"], ".md", () => {
      throw new Error("boom");
    });

    expect(loaded.size).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith("[la-briguade] skipping /tmp/bad.md: boom");
  });
});
