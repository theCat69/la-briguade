import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { collectDirs, collectFiles } from "./content-merge.js";

const tempRoots: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "la-briguade-content-merge-"));
  tempRoots.push(dir);
  return dir;
}

describe("collectFiles", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("should return empty map for empty directory list", () => {
    expect(collectFiles([], ".md")).toEqual(new Map());
  });

  it("should collect markdown files from a single directory", () => {
    const root = makeTempDir();
    writeFileSync(join(root, "coder.md"), "# coder");

    const result = collectFiles([root], ".md");

    expect(result).toEqual(new Map([["coder", join(root, "coder.md")]]));
  });

  it("should merge non-overlapping files from two directories", () => {
    const first = makeTempDir();
    const second = makeTempDir();
    writeFileSync(join(first, "coder.md"), "# coder");
    writeFileSync(join(second, "reviewer.md"), "# reviewer");

    const result = collectFiles([first, second], ".md");

    expect(result).toEqual(
      new Map([
        ["coder", join(first, "coder.md")],
        ["reviewer", join(second, "reviewer.md")],
      ]),
    );
  });

  it("should let later directories override earlier files with same stem", () => {
    const first = makeTempDir();
    const second = makeTempDir();
    writeFileSync(join(first, "coder.md"), "# builtin");
    writeFileSync(join(second, "coder.md"), "# override");

    const result = collectFiles([first, second], ".md");

    expect(result).toEqual(new Map([["coder", join(second, "coder.md")]]));
  });

  it("should skip missing directories", () => {
    const root = makeTempDir();
    writeFileSync(join(root, "coder.md"), "# coder");

    const result = collectFiles([join(root, "missing"), root], ".md");

    expect(result).toEqual(new Map([["coder", join(root, "coder.md")]]));
  });

  it("should only include files matching the extension", () => {
    const root = makeTempDir();
    writeFileSync(join(root, "coder.md"), "# coder");
    writeFileSync(join(root, "notes.txt"), "note");

    const result = collectFiles([root], ".md");

    expect(result).toEqual(new Map([["coder", join(root, "coder.md")]]));
  });
});

describe("collectDirs", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("should return empty map for empty roots", () => {
    expect(collectDirs([])).toEqual(new Map());
  });

  it("should collect immediate subdirectories from a single root", () => {
    const root = makeTempDir();
    mkdirSync(join(root, "frontend"));

    const result = collectDirs([root]);

    expect(result).toEqual(new Map([["frontend", join(root, "frontend")]]));
  });

  it("should merge non-overlapping directory names from two roots", () => {
    const first = makeTempDir();
    const second = makeTempDir();
    mkdirSync(join(first, "frontend"));
    mkdirSync(join(second, "typescript"));

    const result = collectDirs([first, second]);

    expect(result).toEqual(
      new Map([
        ["frontend", join(first, "frontend")],
        ["typescript", join(second, "typescript")],
      ]),
    );
  });

  it("should let later roots override earlier directories with same name", () => {
    const first = makeTempDir();
    const second = makeTempDir();
    mkdirSync(join(first, "frontend"));
    mkdirSync(join(second, "frontend"));

    const result = collectDirs([first, second]);

    expect(result).toEqual(new Map([["frontend", join(second, "frontend")]]));
  });

  it("should skip missing roots", () => {
    const root = makeTempDir();
    mkdirSync(join(root, "frontend"));

    const result = collectDirs([join(root, "missing"), root]);

    expect(result).toEqual(new Map([["frontend", join(root, "frontend")]]));
  });

  it("should skip plain files and collect only subdirectories", () => {
    const root = makeTempDir();
    writeFileSync(join(root, "foo.md"), "# file");
    mkdirSync(join(root, "bar"));

    const result = collectDirs([root]);

    expect(result).toEqual(new Map([["bar", join(root, "bar")]]));
  });
});
