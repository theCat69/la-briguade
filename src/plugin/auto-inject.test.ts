import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock("../utils/logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import { existsSync, readFileSync } from "node:fs";

import { logger } from "../utils/logger.js";
import {
  collectAutoInjectSkills,
  injectAutoInjectSkills,
  resolveActiveSkills,
} from "./auto-inject.js";
import type { AutoInjectEntry } from "./auto-inject.js";
import type { Config } from "../types/plugin.js";

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockLoggerWarn = vi.mocked(logger.warn);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSkillMd(options: {
  agents?: string[];
  detectFiles?: string[];
  detectContent?: Array<{ file: string; contains: string }>;
  body?: string;
}): string {
  const { agents = [], detectFiles = [], detectContent = [], body = "Skill body content." } =
    options;
  const lines: string[] = ["---"];
  if (agents.length > 0) {
    lines.push("agents:");
    for (const agent of agents) {
      lines.push(`  - ${agent}`);
    }
  }
  if (detectFiles.length > 0 || detectContent.length > 0) {
    lines.push("detect:");
    if (detectFiles.length > 0) {
      lines.push("  files:");
      for (const f of detectFiles) {
        lines.push(`    - ${f}`);
      }
    }
    if (detectContent.length > 0) {
      lines.push("  content:");
      for (const { file, contains } of detectContent) {
        lines.push(`    - file: ${file}`);
        lines.push(`      contains: ${contains}`);
      }
    }
  }
  lines.push("---", "", body);
  return lines.join("\n");
}

function makeConfig(agents: Record<string, unknown> = {}): Config {
  return { agent: agents } as Config;
}

function makeEntry(overrides: Partial<AutoInjectEntry> = {}): AutoInjectEntry {
  return {
    skillName: "general-coding",
    body: "Skill guidelines body.",
    agents: ["coder"],
    detectFiles: [],
    detectContent: [],
    ...overrides,
  };
}

// ─── collectAutoInjectSkills ──────────────────────────────────────────────────

describe("collectAutoInjectSkills", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should parse agents and body from a valid SKILL.md", () => {
    // Arrange
    mockReadFileSync.mockReturnValue(
      makeSkillMd({ agents: ["coder", "reviewer"], body: "Best practices." }),
    );

    // Act
    const result = collectAutoInjectSkills(["/skills/general-coding"]);

    // Assert
    expect(result.size).toBe(1);
    const entry = result.get("general-coding");
    expect(entry?.agents).toEqual(["coder", "reviewer"]);
    expect(entry?.body).toBe("Best practices.");
    expect(entry?.detectFiles).toEqual([]);
    expect(entry?.detectContent).toEqual([]);
  });

  it("should parse detect.files from frontmatter", () => {
    // Arrange
    mockReadFileSync.mockReturnValue(
      makeSkillMd({ agents: ["coder"], detectFiles: ["tsconfig.json"], body: "TS guidelines." }),
    );

    // Act
    const result = collectAutoInjectSkills(["/skills/typescript"]);

    // Assert
    const entry = result.get("typescript");
    expect(entry?.detectFiles).toEqual(["tsconfig.json"]);
    expect(entry?.detectContent).toEqual([]);
  });

  it("should parse detect.content from frontmatter", () => {
    // Arrange
    mockReadFileSync.mockReturnValue(
      makeSkillMd({
        agents: ["coder"],
        detectContent: [{ file: "pom.xml", contains: "quarkus" }],
        body: "Quarkus guidelines.",
      }),
    );

    // Act
    const result = collectAutoInjectSkills(["/skills/quarkus"]);

    // Assert
    const entry = result.get("quarkus");
    expect(entry?.detectFiles).toEqual([]);
    expect(entry?.detectContent).toEqual([{ file: "pom.xml", contains: "quarkus" }]);
  });

  it("should silently skip dirs where SKILL.md is absent (ENOENT)", () => {
    // Arrange
    mockReadFileSync.mockImplementation(() => {
      throw Object.assign(new Error("not found"), { code: "ENOENT" });
    });

    // Act
    const result = collectAutoInjectSkills(["/skills/missing"]);

    // Assert
    expect(result.size).toBe(0);
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it("should warn and skip on non-ENOENT read errors", () => {
    // Arrange
    mockReadFileSync.mockImplementation(() => {
      throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    });

    // Act
    const result = collectAutoInjectSkills(["/skills/restricted"]);

    // Assert
    expect(result.size).toBe(0);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining("/skills/restricted/SKILL.md"),
    );
    expect(mockLoggerWarn).toHaveBeenCalledWith(expect.stringContaining("permission denied"));
  });

  it("should warn and skip on invalid frontmatter", () => {
    // Arrange — agents must be an array, not a string
    mockReadFileSync.mockReturnValue("---\nagents: not-an-array\n---\nBody.\n");

    // Act
    const result = collectAutoInjectSkills(["/skills/bad"]);

    // Assert
    expect(result.size).toBe(0);
    expect(mockLoggerWarn).toHaveBeenCalledWith(expect.stringContaining("Invalid auto-inject"));
  });

  it("should collect from multiple dirs using provided order", () => {
    // Arrange
    mockReadFileSync.mockImplementation((filePath) => {
      if (String(filePath).includes("general-coding")) {
        return makeSkillMd({ agents: ["coder"], body: "General body." });
      }
      return makeSkillMd({ agents: ["reviewer"], body: "TypeScript body." });
    });

    // Act
    const result = collectAutoInjectSkills([
      "/skills/general-coding",
      "/skills/typescript",
    ]);

    // Assert
    expect(result.size).toBe(2);
    expect(result.get("general-coding")?.body).toBe("General body.");
    expect(result.get("typescript")?.body).toBe("TypeScript body.");
  });

  it("should prefer canonical project auto-inject dir over legacy skills dir", () => {
    // Arrange
    mockReadFileSync.mockImplementation((filePath) => {
      const path = String(filePath);
      if (path.includes("/project/.la_briguade/skills/typescript/")) {
        return makeSkillMd({ agents: ["coder"], body: "Legacy project skill body." });
      }
      return makeSkillMd({ agents: ["coder"], body: "Canonical auto-inject skill body." });
    });

    // Act
    const result = collectAutoInjectSkills([
      "/project/.la_briguade/skills/typescript",
      "/project/.la_briguade/auto-inject-skills/typescript",
    ]);

    // Assert
    expect(result.size).toBe(1);
    expect(result.get("typescript")?.body).toBe("Canonical auto-inject skill body.");
  });
});

// ─── resolveActiveSkills ──────────────────────────────────────────────────────

describe("resolveActiveSkills", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should mark skill as active when it has no detect constraints", () => {
    // Arrange
    const entries = new Map([["general-coding", makeEntry({ detectFiles: [], detectContent: [] })]]);

    // Act
    const active = resolveActiveSkills(entries, "/project");

    // Assert
    expect(active.has("general-coding")).toBe(true);
  });

  it("should mark skill as active when a detect.files entry exists", () => {
    // Arrange
    const entries = new Map([
      ["typescript", makeEntry({ detectFiles: ["tsconfig.json"], detectContent: [] })],
    ]);
    mockExistsSync.mockImplementation((p) => String(p) === "/project/tsconfig.json");

    // Act
    const active = resolveActiveSkills(entries, "/project");

    // Assert
    expect(active.has("typescript")).toBe(true);
  });

  it("should mark skill as inactive when no detect.files entry exists", () => {
    // Arrange
    const entries = new Map([
      ["angular", makeEntry({ detectFiles: ["angular.json"], detectContent: [] })],
    ]);
    mockExistsSync.mockReturnValue(false);

    // Act
    const active = resolveActiveSkills(entries, "/project");

    // Assert
    expect(active.has("angular")).toBe(false);
  });

  it("should activate via detect.files with OR logic — first match wins", () => {
    // Arrange
    const entries = new Map([
      [
        "java",
        makeEntry({
          detectFiles: ["pom.xml", "build.gradle", "build.gradle.kts"],
          detectContent: [],
        }),
      ],
    ]);
    // Only build.gradle exists
    mockExistsSync.mockImplementation((p) => String(p) === "/project/build.gradle");

    // Act
    const active = resolveActiveSkills(entries, "/project");

    // Assert
    expect(active.has("java")).toBe(true);
  });

  it("should mark skill as active when detect.content file exists and contains substring", () => {
    // Arrange
    const entries = new Map([
      [
        "quarkus",
        makeEntry({
          detectFiles: [],
          detectContent: [{ file: "pom.xml", contains: "quarkus" }],
        }),
      ],
    ]);
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("<dependency>quarkus-core</dependency>");

    // Act
    const active = resolveActiveSkills(entries, "/project");

    // Assert
    expect(active.has("quarkus")).toBe(true);
  });

  it("should mark skill as inactive when detect.content file does not exist", () => {
    // Arrange
    const entries = new Map([
      [
        "quarkus",
        makeEntry({
          detectFiles: [],
          detectContent: [{ file: "pom.xml", contains: "quarkus" }],
        }),
      ],
    ]);
    mockExistsSync.mockReturnValue(false);

    // Act
    const active = resolveActiveSkills(entries, "/project");

    // Assert
    expect(active.has("quarkus")).toBe(false);
  });

  it("should mark skill as inactive when file exists but does not contain substring", () => {
    // Arrange
    const entries = new Map([
      [
        "quarkus",
        makeEntry({
          detectFiles: [],
          detectContent: [{ file: "pom.xml", contains: "quarkus" }],
        }),
      ],
    ]);
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("<dependency>spring-boot</dependency>");

    // Act
    const active = resolveActiveSkills(entries, "/project");

    // Assert
    expect(active.has("quarkus")).toBe(false);
  });

  it("should activate via detect.content with OR logic — second entry matches", () => {
    // Arrange
    const entries = new Map([
      [
        "quarkus",
        makeEntry({
          detectFiles: [],
          detectContent: [
            { file: "pom.xml", contains: "quarkus" },
            { file: "build.gradle", contains: "quarkus" },
          ],
        }),
      ],
    ]);
    mockExistsSync.mockImplementation((p) => String(p) === "/project/build.gradle");
    mockReadFileSync.mockReturnValue('implementation "io.quarkus:quarkus-resteasy"');

    // Act
    const active = resolveActiveSkills(entries, "/project");

    // Assert
    expect(active.has("quarkus")).toBe(true);
  });
});

// ─── injectAutoInjectSkills ───────────────────────────────────────────────────

describe("injectAutoInjectSkills", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should inject skill body into agent listed in skill's agents array", () => {
    // Arrange
    const config = makeConfig({ coder: { prompt: "Base coder prompt." } });
    const entries = new Map([["general-coding", makeEntry({ agents: ["coder"], body: "Guidelines." })]]);
    const active = new Set(["general-coding"]);

    // Act
    injectAutoInjectSkills(config, entries, active);

    // Assert
    const coder = config.agent?.["coder"] as Record<string, unknown>;
    expect(coder["prompt"]).toBe("Base coder prompt.\n\nGuidelines.");
  });

  it("should inject skill body into agent with explicit allow permission", () => {
    // Arrange
    const config = makeConfig({
      coder: {
        prompt: "Base.",
        permission: { skill: { "general-coding": "allow" } },
      },
    });
    const entries = new Map([
      ["general-coding", makeEntry({ agents: [], body: "Guidelines." })],
    ]);
    const active = new Set(["general-coding"]);

    // Act
    injectAutoInjectSkills(config, entries, active);

    // Assert
    const coder = config.agent?.["coder"] as Record<string, unknown>;
    expect(coder["prompt"]).toBe("Base.\n\nGuidelines.");
  });

  it("should inject skill body into agent with explicit ask permission", () => {
    // Arrange
    const config = makeConfig({
      reviewer: {
        prompt: "Reviewer base.",
        permission: { skill: { typescript: "ask" } },
      },
    });
    const entries = new Map([["typescript", makeEntry({ agents: [], body: "TS guidelines." })]]);
    const active = new Set(["typescript"]);

    // Act
    injectAutoInjectSkills(config, entries, active);

    // Assert
    const reviewer = config.agent?.["reviewer"] as Record<string, unknown>;
    expect(reviewer["prompt"]).toBe("Reviewer base.\n\nTS guidelines.");
  });

  it("should not inject skill body via wildcard permission", () => {
    // Arrange
    const config = makeConfig({
      coder: {
        prompt: "Base.",
        permission: { skill: { "*": "allow" } },
      },
    });
    const entries = new Map([
      ["general-coding", makeEntry({ agents: [], body: "Guidelines." })],
    ]);
    const active = new Set(["general-coding"]);

    // Act
    injectAutoInjectSkills(config, entries, active);

    // Assert
    const coder = config.agent?.["coder"] as Record<string, unknown>;
    expect(coder["prompt"]).toBe("Base.");
  });

  it("should not inject inactive skills", () => {
    // Arrange
    const config = makeConfig({ coder: { prompt: "Base." } });
    const entries = new Map([
      ["angular", makeEntry({ agents: ["coder"], body: "Angular guidelines." })],
    ]);
    const active = new Set<string>(); // angular is not active

    // Act
    injectAutoInjectSkills(config, entries, active);

    // Assert
    const coder = config.agent?.["coder"] as Record<string, unknown>;
    expect(coder["prompt"]).toBe("Base.");
  });

  it("should set prompt when agent has no existing prompt", () => {
    // Arrange
    const config = makeConfig({ coder: {} });
    const entries = new Map([["general-coding", makeEntry({ agents: ["coder"], body: "Guidelines." })]]);
    const active = new Set(["general-coding"]);

    // Act
    injectAutoInjectSkills(config, entries, active);

    // Assert
    const coder = config.agent?.["coder"] as Record<string, unknown>;
    expect(coder["prompt"]).toBe("Guidelines.");
  });

  it("should append multiple active skills to the same agent prompt", () => {
    // Arrange
    const config = makeConfig({ coder: { prompt: "Base." } });
    const entries = new Map([
      ["general-coding", makeEntry({ skillName: "general-coding", agents: ["coder"], body: "General." })],
      ["typescript", makeEntry({ skillName: "typescript", agents: ["coder"], body: "TypeScript." })],
    ]);
    const active = new Set(["general-coding", "typescript"]);

    // Act
    injectAutoInjectSkills(config, entries, active);

    // Assert
    const coder = config.agent?.["coder"] as Record<string, unknown>;
    expect(coder["prompt"]).toBe("Base.\n\nGeneral.\n\nTypeScript.");
  });

  it("should not inject skill with empty body", () => {
    // Arrange
    const config = makeConfig({ coder: { prompt: "Base." } });
    const entries = new Map([["empty-skill", makeEntry({ agents: ["coder"], body: "" })]]);
    const active = new Set(["empty-skill"]);

    // Act
    injectAutoInjectSkills(config, entries, active);

    // Assert
    const coder = config.agent?.["coder"] as Record<string, unknown>;
    expect(coder["prompt"]).toBe("Base.");
  });

  it("should skip non-record agent configs without error", () => {
    // Arrange
    const config = makeConfig({ coder: null });
    const entries = new Map([["general-coding", makeEntry({ agents: ["coder"], body: "Guidelines." })]]);
    const active = new Set(["general-coding"]);

    // Act + Assert (no throw)
    expect(() => injectAutoInjectSkills(config, entries, active)).not.toThrow();
  });

  it("should do nothing when input.agent is not a record", () => {
    // Arrange
    const config = { agent: null } as unknown as Config;
    const entries = new Map([["general-coding", makeEntry()]]);
    const active = new Set(["general-coding"]);

    // Act + Assert (no throw)
    expect(() => injectAutoInjectSkills(config, entries, active)).not.toThrow();
  });

  it("should not inject into agent not in skill agents list and with deny permission", () => {
    // Arrange
    const config = makeConfig({
      coder: {
        prompt: "Base.",
        permission: { skill: { "general-coding": "deny" } },
      },
    });
    const entries = new Map([
      ["general-coding", makeEntry({ agents: [], body: "Guidelines." })],
    ]);
    const active = new Set(["general-coding"]);

    // Act
    injectAutoInjectSkills(config, entries, active);

    // Assert
    const coder = config.agent?.["coder"] as Record<string, unknown>;
    expect(coder["prompt"]).toBe("Base.");
  });
});
