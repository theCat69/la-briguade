import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..", "..");

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

  it("should require cache-ctrl contract in init-implementer local cache instructions", () => {
    const content = readContentFile("content/commands/init-implementer.md");

    expect(content).toContain("Cache authority rule (scoped): `cache-ctrl` authority applies to **local-context-gatherer only**.");
    expect(content).toContain("For `local-context-gatherer`: do **not** instruct direct cache JSON edits");
    expect(content).toContain("For other sub-agents (including `external-context-gatherer`): follow each agent's own documented cache mechanism.");
    expect(content).toContain("cache_ctrl_write");
    expect(content).toContain("cache_ctrl_inspect");
    expect(content).toContain("Cache results to `.ai/external-context-gatherer_cache/` (one JSON file per technology). Use the `edit` tool to write cache files");
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
    const implementPrdContent = readContentFile("content/commands/implement-prd.md");

    expect(orchestratorContent).toContain("only when the user explicitly requests security review");
    expect(builderContent).toContain("only if the user explicitly requested a security");
    expect(justDoItContent).toContain("only if the user explicitly asked for a security review");
    expect(refactorContent).toContain("only if the user explicitly requests a security review");
    expect(implementPrdContent).toContain("only if the user explicitly requested a security review");
  });

  it("should enforce cache-ctrl write verification contract for local-context-gatherer", () => {
    const content = readContentFile("content/agents/local-context-gatherer.md");

    const coldStartIndex = content.indexOf("Cold start rule:");
    const writeIndex = content.indexOf("Write: submit only the scanned files in `tracked_files`.");
    const verifyIndex = content.indexOf("Post-write verification (mandatory for reliability/observability)");

    expect(coldStartIndex).toBeGreaterThan(-1);
    expect(writeIndex).toBeGreaterThan(-1);
    expect(verifyIndex).toBeGreaterThan(-1);
    expect(coldStartIndex).toBeLessThan(writeIndex);
    expect(writeIndex).toBeLessThan(verifyIndex);

    expect(content).toContain("Use `cache_ctrl_write` as the canonical write path");
    expect(content).toContain("Post-write verification (mandatory for reliability/observability)");
    expect(content).toContain("cache write failed");
    expect(content).toContain("Write status (`written`, `verified`, `retries`)");
  });

  it("should keep AGENTS.md canonical pointer on auto-inject skills", () => {
    const content = readContentFile("AGENTS.md");

    expect(content).toContain(".la_briguade/auto-inject-skills/*/SKILL.md");
    expect(content).toContain("(authoritative)");
    expect(content).toContain(".la_briguade/skills/*/SKILL.md");
    expect(content).toContain("Optional mirror");
    expect(content).not.toContain("Detailed, stack-specific guidelines are in `.opencode/skills/`.");
  });

  it("should require richer contract sections in checked-in auto-inject skills", () => {
    const skillFiles = [
      ".la_briguade/auto-inject-skills/project-coding/SKILL.md",
      ".la_briguade/auto-inject-skills/project-build/SKILL.md",
      ".la_briguade/auto-inject-skills/project-test/SKILL.md",
      ".la_briguade/auto-inject-skills/project-documentation/SKILL.md",
      ".la_briguade/auto-inject-skills/project-security/SKILL.md",
      ".la_briguade/auto-inject-skills/project-code-examples/SKILL.md",
    ] as const;

    for (const skillPath of skillFiles) {
      const content = readContentFile(skillPath);

      expect(content).toContain("## Scope");
      expect(content).toContain("## Invariants");
      expect(content).toContain("## Validation Checklist");
      expect(content).toContain("## Failure Handling");
    }
  });

  it("should require init-implementer agents frontmatter contract in checked-in auto-inject skills", () => {
    const expectedAgentsBySkillPath = {
      ".la_briguade/auto-inject-skills/project-coding/SKILL.md": [
        "coder",
        "reviewer",
        "architect",
        "feature-designer",
        "feature-reviewer",
        "planner",
        "ask",
        "builder",
        "orchestrator",
      ],
      ".la_briguade/auto-inject-skills/project-build/SKILL.md": [
        "coder",
        "builder",
        "orchestrator",
      ],
      ".la_briguade/auto-inject-skills/project-test/SKILL.md": ["coder", "reviewer", "builder"],
      ".la_briguade/auto-inject-skills/project-documentation/SKILL.md": ["coder", "reviewer"],
      ".la_briguade/auto-inject-skills/project-security/SKILL.md": [
        "coder",
        "reviewer",
        "security-reviewer",
      ],
      ".la_briguade/auto-inject-skills/project-code-examples/SKILL.md": [
        "coder",
        "reviewer",
        "architect",
        "builder",
      ],
    } as const;

    for (const [skillPath, expectedAgents] of Object.entries(expectedAgentsBySkillPath)) {
      const content = readContentFile(skillPath);
      expect(content).toContain("agents:");

      for (const expectedAgent of expectedAgents) {
        expect(content).toContain(`  - ${expectedAgent}`);
      }
    }
  });

  it("should keep project-documentation guidance aligned with current frontmatter policy", () => {
    const content = readContentFile(
      ".la_briguade/auto-inject-skills/project-documentation/SKILL.md",
    );

    expect(content).toContain(
      "Have frontmatter with metadata keys actually consumed by `src/plugin/agents.ts`",
    );
    expect(content).toContain(
      "Have frontmatter with `name`, `description`, and `agents` for project auto-inject skills",
    );
    expect(content).not.toContain("Have frontmatter with exactly `name` and `description`");
    expect(content).not.toContain(
      "Have frontmatter with at minimum: `name`, `description`, `type` (`primary` | `subagent`)",
    );
  });
});
