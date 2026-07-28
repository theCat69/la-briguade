import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..", "..");
const FRAMEWORK_SKILL_PATHS = [
  "content/auto-inject-skills/nextjs/SKILL.md",
  "content/auto-inject-skills/react/SKILL.md",
  "content/auto-inject-skills/react-native/SKILL.md",
  "content/auto-inject-skills/flutter/SKILL.md",
  "content/auto-inject-skills/dioxus/SKILL.md",
  "content/auto-inject-skills/axum/SKILL.md",
] as const;
const EXPECTED_FRAMEWORK_AGENTS = [
  "coder",
  "reviewer",
  "architect",
  "feature-designer",
  "feature-reviewer",
  "planner",
  "ask",
  "builder",
  "orchestrator",
] as const;

function readContentFile(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("prompt policy contracts", () => {
  it("should keep init-implementer default generation scope as auto-inject only", () => {
    const content = readContentFile("content/commands/init-implementer.md");

    expect(content).toContain("Default generation scope policy:");
    expect(content).toContain(
      "generate only\n  `.la_briguade/auto-inject-skills/*/SKILL.md`",
    );
    expect(content).toContain("Generate `.la_briguade/skills/*/SKILL.md` only on explicit");
    expect(content).toContain("Every generated skill MUST include stronger contracts");
    expect(content).toContain("## Invariants");
    expect(content).toContain("## Validation Checklist");
    expect(content).toContain("## Failure Handling");
  });

  it("should keep auto-inject canonical and regular skills as explicit optional mirrors", () => {
    const content = readContentFile("content/commands/init-implementer.md");

    expect(content).toContain("Canonical source is `.la_briguade/auto-inject-skills/`.");
    expect(content).toContain("optional mirrored copies only when explicitly requested");
    expect(content).not.toContain("Content should live in exactly one place");
  });

  it("should require explicit security-reviewer invocation in workflow prompts", () => {
    const orchestratorContent = readContentFile("content/agents/Orchestrator.md");
    const builderContent = readContentFile("content/agents/Builder.md");
    const justDoItContent = readContentFile("content/commands/just-do-it.md");
    const refactorContent = readContentFile("content/commands/refactor.md");
    const implementContent = readContentFile("content/commands/implement.md");

    expect(orchestratorContent).toMatch(/security-reviewer[\s\S]*explicitly requested/i);
    expect(builderContent).toMatch(/security-reviewer[\s\S]*explicitly requested/i);
    expect(justDoItContent).toMatch(/security-reviewer[\s\S]*explicitly requested/i);
    expect(refactorContent).toMatch(/security-reviewer[\s\S]*explicitly requests?/i);
    expect(implementContent).toMatch(/security-reviewer[\s\S]*when applicable/i);
  });

  it("should provide the spec-to-ticket workflow without legacy planning commands", () => {
    const toSpecContent = readContentFile("content/commands/to-spec.md");
    const toTicketsContent = readContentFile("content/commands/to-tickets.md");
    const implementContent = readContentFile("content/commands/implement.md");

    expect(toSpecContent).toContain("Do not restart requirements discovery");
    expect(toSpecContent).toContain(".scratch/<feature-slug>/spec.md");
    expect(toTicketsContent).toContain("tracer-bullet vertical slices");
    expect(toTicketsContent).toContain(".scratch/<feature-slug>/issues/<NN>-<slug>.md");
    expect(implementContent).toContain("unblocked frontier ticket");
  });

  it("should keep AGENTS.md canonical pointer on auto-inject skills", () => {
    const content = readContentFile("AGENTS.md");

    expect(content).toContain(".la_briguade/auto-inject-skills/*/SKILL.md");
    expect(content).toContain("(authoritative)");
    expect(content).toContain(".la_briguade/skills/*/SKILL.md");
    expect(content).toContain("Optional mirror");
    expect(content).not.toContain("Detailed, stack-specific guidelines are in `.opencode/skills/`.");
  });

  it("should require richer contract sections in framework auto-inject skills", () => {
    for (const skillPath of FRAMEWORK_SKILL_PATHS) {
      const content = readContentFile(skillPath);

      expect(content).toContain("## Scope");
      expect(content).toContain("## Invariants");
      expect(content).toContain("## Validation Checklist");
      expect(content).toContain("## Failure Handling");
    }
  });

  it("should require framework auto-inject skills to declare the full agent opt-in contract", () => {
    for (const skillPath of FRAMEWORK_SKILL_PATHS) {
      const content = readContentFile(skillPath);
      expect(content).toContain("agents:");

      for (const expectedAgent of EXPECTED_FRAMEWORK_AGENTS) {
        expect(content).toContain(`  - ${expectedAgent}`);
      }
    }
  });

  it("should require realistic detection markers for framework auto-inject skills", () => {
    const nextjs = readContentFile("content/auto-inject-skills/nextjs/SKILL.md");
    const react = readContentFile("content/auto-inject-skills/react/SKILL.md");
    const reactNative = readContentFile("content/auto-inject-skills/react-native/SKILL.md");
    const flutter = readContentFile("content/auto-inject-skills/flutter/SKILL.md");
    const dioxus = readContentFile("content/auto-inject-skills/dioxus/SKILL.md");
    const axum = readContentFile("content/auto-inject-skills/axum/SKILL.md");

    expect(nextjs).toContain("- file: package.json");
    expect(nextjs).toContain("contains: '\"next\"'");
    expect(react).toContain("- file: package.json");
    expect(react).toContain("contains: '\"react\"'");
    expect(reactNative).toContain("- file: package.json");
    expect(reactNative).toContain("contains: '\"react-native\"'");
    expect(flutter).toContain("- file: pubspec.yaml");
    expect(flutter).toContain('contains: "flutter:"');
    expect(dioxus).toContain("- file: Cargo.toml");
    expect(dioxus).toContain('contains: "dioxus ="');
    expect(axum).toContain("- file: Cargo.toml");
    expect(axum).toContain('contains: "axum ="');
  });
});
