import { afterEach, describe, expect, it, vi } from "vitest";

import { registerCommands } from "./commands.js";

import type { Config } from "../types/plugin.js";
import { collectFiles } from "../utils/content-merge.js";
import { readContentFile } from "../utils/read-content-file.js";

vi.mock("../utils/content-merge.js");
vi.mock("../utils/read-content-file.js");

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
      throw new Error(`Could not read command file: ${String(filePath)}`);
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const config = makeConfig();

    registerCommands(config, ["/builtin/commands"]);

    expect(config.command).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "[la-briguade] skipping /builtin/commands/critic.md: Could not read command file:",
      ),
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
});
