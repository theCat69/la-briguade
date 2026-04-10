import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { registerCommands } from "./commands.js";

import type { Config } from "../types/plugin.js";
import { collectFiles } from "../utils/content-merge.js";

vi.mock("node:fs");
vi.mock("../utils/content-merge.js");

const mockReadFileSync = vi.mocked(readFileSync);
const mockCollectFiles = vi.mocked(collectFiles);

function makeConfig(): Config {
  return { command: {} } as Config;
}

describe("registerCommands", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should register command template from merged files", () => {
    mockCollectFiles.mockReturnValue(new Map([["critic", "/builtin/commands/critic.md"]]));
    mockReadFileSync.mockReturnValue("---\ndescription: Critic\n---\nReview this.");

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
    mockReadFileSync.mockReturnValue("Project critic command");

    const config = makeConfig();

    registerCommands(config, ["/builtin/commands", "/project/content/commands"]);

    expect(config.command?.["critic"]).toMatchObject({
      template: "Project critic command",
    });
  });
});
