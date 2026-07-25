import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { collectAutoInjectSkills, resolveActiveSkills } from "./auto-inject.js";
import type { AutoInjectEntry } from "./auto-inject.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..", "..");

const tempDirs: string[] = [];

function createTempProject(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "la-briguade-auto-inject-"));
  tempDirs.push(dir);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(dir, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, "utf8");
  }

  return dir;
}

function initializeGitRepository(projectDir: string): void {
  execFileSync("git", ["init", "--quiet", projectDir]);
}

function stageGitFile(projectDir: string, relativePath: string): void {
  execFileSync("git", ["-C", projectDir, "add", "--", relativePath]);
}

describe("auto-inject framework detection contracts", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("should not activate react skill when package.json exists without react marker", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/react"),
    ]);
    const tempProject = createTempProject({
      "package.json": JSON.stringify({ name: "service", private: true }, null, 2),
    });

    // Act
    const active = resolveActiveSkills(entries, tempProject);

    // Assert
    expect(active.has("react")).toBe(false);
  });

  it("should not activate nextjs skill when package.json exists without next marker", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/nextjs"),
    ]);
    const tempProject = createTempProject({
      "package.json": JSON.stringify({ name: "service", private: true }, null, 2),
    });

    // Act
    const active = resolveActiveSkills(entries, tempProject);

    // Assert
    expect(active.has("nextjs")).toBe(false);
  });

  it("should activate nextjs skill when package.json contains next dependency", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/nextjs"),
    ]);
    const tempProject = createTempProject({
      "package.json": JSON.stringify(
        { name: "web", dependencies: { next: "^16.0.0" } },
        null,
        2,
      ),
    });

    // Act
    const active = resolveActiveSkills(entries, tempProject);

    // Assert
    expect(active.has("nextjs")).toBe(true);
  });

  it("should activate react skill when package.json contains react dependency", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/react"),
    ]);
    const tempProject = createTempProject({
      "package.json": JSON.stringify(
        { name: "web", dependencies: { react: "^19.0.0" } },
        null,
        2,
      ),
    });

    // Act
    const active = resolveActiveSkills(entries, tempProject);

    // Assert
    expect(active.has("react")).toBe(true);
  });

  it("should not activate react-native skill when package.json exists without react-native marker", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/react-native"),
    ]);
    const tempProject = createTempProject({
      "package.json": JSON.stringify({ name: "mobile", private: true }, null, 2),
    });

    // Act
    const active = resolveActiveSkills(entries, tempProject);

    // Assert
    expect(active.has("react-native")).toBe(false);
  });

  it("should activate react-native skill when package.json contains react-native dependency", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/react-native"),
    ]);
    const tempProject = createTempProject({
      "package.json": JSON.stringify(
        { name: "mobile", dependencies: { "react-native": "0.82.0" } },
        null,
        2,
      ),
    });

    // Act
    const active = resolveActiveSkills(entries, tempProject);

    // Assert
    expect(active.has("react-native")).toBe(true);
  });

  it("should not activate flutter skill when pubspec.yaml exists without flutter sdk", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/flutter"),
    ]);
    const tempProject = createTempProject({
      "pubspec.yaml": "name: shared_dart_pkg\nenvironment:\n  sdk: '>=3.0.0 <4.0.0'\n",
    });

    // Act
    const active = resolveActiveSkills(entries, tempProject);

    // Assert
    expect(active.has("flutter")).toBe(false);
  });

  it("should activate flutter skill when pubspec.yaml contains flutter marker", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/flutter"),
    ]);
    const tempProject = createTempProject({
      "pubspec.yaml": [
        "name: app",
        "environment:",
        "  sdk: '>=3.0.0 <4.0.0'",
        "dependencies:",
        "  flutter:",
        "    sdk: flutter",
      ].join("\n"),
    });

    // Act
    const active = resolveActiveSkills(entries, tempProject);

    // Assert
    expect(active.has("flutter")).toBe(true);
  });

  it("should not activate dioxus skill when Cargo.toml exists without dioxus marker", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/dioxus"),
    ]);
    const tempProject = createTempProject({
      "Cargo.toml": [
        "[package]",
        "name = \"service\"",
        "version = \"0.1.0\"",
        "edition = \"2021\"",
        "",
        "[dependencies]",
        "serde = \"1\"",
      ].join("\n"),
    });

    // Act
    const active = resolveActiveSkills(entries, tempProject);

    // Assert
    expect(active.has("dioxus")).toBe(false);
  });

  it("should activate dioxus skill when Cargo.toml contains dioxus dependency", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/dioxus"),
    ]);
    const tempProject = createTempProject({
      "Cargo.toml": [
        "[package]",
        "name = \"ui\"",
        "version = \"0.1.0\"",
        "edition = \"2021\"",
        "",
        "[dependencies]",
        "dioxus = \"0.7\"",
      ].join("\n"),
    });

    // Act
    const active = resolveActiveSkills(entries, tempProject);

    // Assert
    expect(active.has("dioxus")).toBe(true);
  });

  it("should not activate axum skill when Cargo.toml exists without axum marker", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/axum"),
    ]);
    const tempProject = createTempProject({
      "Cargo.toml": [
        "[package]",
        "name = \"service\"",
        "version = \"0.1.0\"",
        "edition = \"2021\"",
        "",
        "[dependencies]",
        "tokio = { version = \"1\", features = [\"rt-multi-thread\"] }",
      ].join("\n"),
    });

    // Act
    const active = resolveActiveSkills(entries, tempProject);

    // Assert
    expect(active.has("axum")).toBe(false);
  });

  it("should activate axum skill when Cargo.toml contains axum dependency", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/axum"),
    ]);
    const tempProject = createTempProject({
      "Cargo.toml": [
        "[package]",
        "name = \"api\"",
        "version = \"0.1.0\"",
        "edition = \"2021\"",
        "",
        "[dependencies]",
        "axum = \"0.8\"",
      ].join("\n"),
    });

    // Act
    const active = resolveActiveSkills(entries, tempProject);

    // Assert
    expect(active.has("axum")).toBe(true);
  });

  it("should find a detected filename in a nested workspace within max depth", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/typescript"),
    ]);
    const tempProject = createTempProject({
      "packages/app/tsconfig.json": JSON.stringify({ compilerOptions: {} }),
    });
    initializeGitRepository(tempProject);

    // Act
    const active = resolveActiveSkills(entries, tempProject, { maxDepth: 2 });

    // Assert
    expect(active.has("typescript")).toBe(true);
  });

  it("should not inspect files deeper than the configured detection depth", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/typescript"),
    ]);
    const tempProject = createTempProject({
      "packages/app/tsconfig.json": JSON.stringify({ compilerOptions: {} }),
    });
    initializeGitRepository(tempProject);

    // Act
    const active = resolveActiveSkills(entries, tempProject, { maxDepth: 1 });

    // Assert
    expect(active.has("typescript")).toBe(false);
  });

  it("should not match a tracked detection file deleted from the working tree", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/typescript"),
    ]);
    const tempProject = createTempProject({
      "packages/app/tsconfig.json": JSON.stringify({ compilerOptions: {} }),
    });
    initializeGitRepository(tempProject);
    stageGitFile(tempProject, "packages/app/tsconfig.json");
    rmSync(join(tempProject, "packages/app/tsconfig.json"));

    // Act
    const active = resolveActiveSkills(entries, tempProject, { maxDepth: 2 });

    // Assert
    expect(active.has("typescript")).toBe(false);
  });

  it("should find a content marker in a nested workspace within max depth", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/react"),
    ]);
    const tempProject = createTempProject({
      "apps/web/package.json": JSON.stringify({ dependencies: { react: "^19.0.0" } }),
    });

    // Act
    const active = resolveActiveSkills(entries, tempProject, { maxDepth: 2 });

    // Assert
    expect(active.has("react")).toBe(true);
  });

  it("should ignore nested directories covered by the Git ignore rules", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/react"),
    ]);
    const tempProject = createTempProject({
      ".gitignore": "build/\n",
      "build/react/package.json": JSON.stringify({ dependencies: { react: "^19.0.0" } }),
    });
    initializeGitRepository(tempProject);

    // Act
    const active = resolveActiveSkills(entries, tempProject, { maxDepth: 3 });

    // Assert
    expect(active.has("react")).toBe(false);
  });

  it("should ignore a root detection file covered by Git ignore rules", () => {
    // Arrange
    const entries = collectAutoInjectSkills([
      join(projectRoot, "content/auto-inject-skills/typescript"),
    ]);
    const tempProject = createTempProject({
      ".gitignore": "tsconfig.json\n",
      "tsconfig.json": JSON.stringify({ compilerOptions: {} }),
    });
    initializeGitRepository(tempProject);

    // Act
    const active = resolveActiveSkills(entries, tempProject);

    // Assert
    expect(active.has("typescript")).toBe(false);
  });

  it("should not match an explicit path deeper than the configured detection depth", () => {
    // Arrange
    const entry: AutoInjectEntry = {
      skillName: "custom",
      skillDecription: "",
      body: "",
      agents: [],
      detectFiles: ["packages/app/tsconfig.json"],
      detectContent: [],
    };
    const tempProject = createTempProject({
      "packages/app/tsconfig.json": JSON.stringify({ compilerOptions: {} }),
    });

    // Act
    const active = resolveActiveSkills(new Map([[entry.skillName, entry]]), tempProject, {
      maxDepth: 1,
    });

    // Assert
    expect(active.has("custom")).toBe(false);
  });
});
