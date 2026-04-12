import { afterEach, describe, expect, it, vi } from "vitest";

import { registerSkills } from "./skills.js";

import type { Config } from "../types/plugin.js";
import { collectDirs } from "../utils/content-merge.js";

vi.mock("../utils/content-merge.js");

const mockCollectDirs = vi.mocked(collectDirs);

function makeConfig(): Config {
  return {} as Config;
}

describe("registerSkills", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should register discovered skill directories into config.skills.paths", () => {
    mockCollectDirs.mockReturnValue(new Map([["frontend", "/builtin/skills/frontend"]]));

    const config = makeConfig();

    const result = registerSkills(config, ["/builtin/skills"]);

    expect(result.dirs).toEqual(["/builtin/skills/frontend"]);
    expect((config as Record<string, unknown>)["skills"]).toEqual({
      paths: ["/builtin/skills/frontend"],
    });
  });

  it("should keep overridden skill directory from later root", () => {
    mockCollectDirs.mockReturnValue(new Map([["frontend", "/project/content/skills/frontend"]]));

    const config = makeConfig();

    const result = registerSkills(config, ["/builtin/skills", "/project/content/skills"]);

    expect(result.dirs).toEqual(["/project/content/skills/frontend"]);
    expect((config as Record<string, unknown>)["skills"]).toEqual({
      paths: ["/project/content/skills/frontend"],
    });
  });

  it("should register additive skill directories from multiple roots", () => {
    mockCollectDirs.mockReturnValue(
      new Map([
        ["frontend", "/builtin/skills/frontend"],
        ["typescript", "/project/content/skills/typescript"],
      ]),
    );

    const config = makeConfig();

    const result = registerSkills(config, ["/builtin/skills", "/project/content/skills"]);

    expect(result.dirs).toEqual([
      "/builtin/skills/frontend",
      "/project/content/skills/typescript",
    ]);
    expect((config as Record<string, unknown>)["skills"]).toEqual({
      paths: [
        "/builtin/skills/frontend",
        "/project/content/skills/typescript",
      ],
    });
  });

  it("should return empty dirs and keep config unchanged when no skill dirs are discovered", () => {
    mockCollectDirs.mockReturnValue(new Map());

    const config = makeConfig();
    const initialConfig = { ...(config as Record<string, unknown>) };

    const result = registerSkills(config, ["/builtin/skills"]);

    expect(result.dirs).toEqual([]);
    expect(config).toEqual(initialConfig);
    expect((config as Record<string, unknown>)["skills"]).toBeUndefined();
  });

  it("should return early without mutating when config is not a record", () => {
    // Arrange
    mockCollectDirs.mockReturnValue(new Map([["frontend", "/builtin/skills/frontend"]]));
    const config = "not-an-object" as unknown as Config;

    // Act
    const result = registerSkills(config, ["/builtin/skills"]);

    // Assert
    expect(result.dirs).toEqual(["/builtin/skills/frontend"]);
    expect(config).toBe("not-an-object");
  });
});
