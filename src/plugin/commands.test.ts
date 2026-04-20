import { afterEach, describe, expect, it, vi } from "vitest";

import { registerCommands } from "./commands.js";

import type { Config } from "../types/plugin.js";
import { collectFiles } from "../utils/content/content-merge.js";
import { readContentFile } from "../utils/content/read-content-file.js";
import { logger } from "../utils/runtime/logger.js";

vi.mock("../utils/content/content-merge.js");
vi.mock("../utils/content/read-content-file.js");

const mockCollectFiles = vi.mocked(collectFiles);
const mockReadContentFile = vi.mocked(readContentFile);

function makeConfig(): Config {
  return { command: {} } as Config;
}

describe("registerCommands", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should register command template from merged files", () => {
    mockCollectFiles.mockReturnValue(new Map([["critic", "/builtin/commands/critic.md"]]));
    mockReadContentFile.mockReturnValue("---\ndescription: Critic\n---\nReview this.");

    const config = makeConfig();

    registerCommands(config, ["/builtin/commands"]);

    expect(config.command?.["critic"]).toMatchObject({
      description: "Critic",
      template: "Review this.",
    });
  });

  it("should keep command from later directory when stems overlap", () => {
    mockCollectFiles.mockReturnValue(
      new Map([["critic", "/project/content/commands/critic.md"]]),
    );
    mockReadContentFile.mockReturnValue("Project critic command");

    const config = makeConfig();

    registerCommands(config, ["/builtin/commands", "/project/content/commands"]);

    expect(config.command?.["critic"]).toMatchObject({
      template: "Project critic command",
    });
  });

  it("should warn and skip when reading a command file fails", () => {
    mockCollectFiles.mockReturnValue(new Map([["critic", "/builtin/commands/critic.md"]]));
    mockReadContentFile.mockImplementation((filePath) => {
      throw new Error(`Could not read command file: ${filePath}`);
    });
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    const config = makeConfig();

    registerCommands(config, ["/builtin/commands"]);

    expect(config.command).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("skipping /builtin/commands/critic.md: Could not read command file:"),
    );
  });

  it("should parse agent, model, and subtask from frontmatter", () => {
    mockCollectFiles.mockReturnValue(new Map([["unslop", "/builtin/commands/unslop.md"]]));
    mockReadContentFile.mockReturnValue(
      [
        "---",
        "description: Run unslop",
        "agent: coder",
        "model: gpt-5.3-codex",
        "subtask: true",
        "---",
        "Cleanup this file.",
      ].join("\n"),
    );

    const config = makeConfig();

    registerCommands(config, ["/builtin/commands"]);

    expect(config.command?.["unslop"]).toMatchObject({
      description: "Run unslop",
      agent: "coder",
      model: "gpt-5.3-codex",
      subtask: true,
      template: "Cleanup this file.",
    });
  });

  it("should register unslop-loop description with reduce option guidance", () => {
    mockCollectFiles.mockReturnValue(
      new Map([["unslop-loop", "/builtin/commands/unslop-loop.md"]]),
    );
    mockReadContentFile.mockReturnValue(
      [
        "---",
        "description: Run AI slop cleanup in a loop — supports --reduce",
        "---",
        "Use --reduce to focus on codebase-size reduction.",
      ].join("\n"),
    );

    const config = makeConfig();

    registerCommands(config, ["/builtin/commands"]);

    expect(config.command?.["unslop-loop"]).toMatchObject({
      description: "Run AI slop cleanup in a loop — supports --reduce",
      template: "Use --reduce to focus on codebase-size reduction.",
    });
  });

  it("should register update-implementer command with refresh semantics", () => {
    mockCollectFiles.mockReturnValue(
      new Map([["update-implementer", "/builtin/commands/update-implementer.md"]]),
    );
    mockReadContentFile.mockReturnValue(
      [
        "---",
        "description: Force-refresh implementer setup",
        "---",
        "Reconcile markdown artifacts with code as source of truth.",
      ].join("\n"),
    );

    const config = makeConfig();

    registerCommands(config, ["/builtin/commands"]);

    expect(config.command?.["update-implementer"]).toMatchObject({
      description: "Force-refresh implementer setup",
      template: "Reconcile markdown artifacts with code as source of truth.",
    });
  });
});
