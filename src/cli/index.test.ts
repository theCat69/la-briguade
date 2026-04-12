import { afterEach, describe, expect, it, vi } from "vitest";

import { spawnSync } from "node:child_process";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

const mockSpawnSync = vi.mocked(spawnSync);

async function runUpdateCommand(): Promise<void> {
  vi.resetModules();
  process.argv = ["node", "la-briguade", "update"];
  await import("./index.js");
}

describe("cli update command", () => {
  const originalArgv = [...process.argv];
  const originalExitCode = process.exitCode;

  afterEach(() => {
    process.argv = [...originalArgv];
    process.exitCode = originalExitCode;
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should complete without setting exitCode when npm update succeeds", async () => {
    // Arrange
    process.exitCode = undefined;
    mockSpawnSync.mockReturnValue({ status: 0, signal: null } as never);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    await runUpdateCommand();

    // Assert
    expect(process.exitCode).toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("should set exitCode and print error when npm update exits non-zero", async () => {
    // Arrange
    process.exitCode = undefined;
    mockSpawnSync.mockReturnValue({ status: 1, signal: null } as never);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    await runUpdateCommand();

    // Assert
    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "[la-briguade] Update failed with exit code 1.",
    );
  });

  it("should set exitCode and report error when spawnSync throws", async () => {
    // Arrange
    process.exitCode = undefined;
    mockSpawnSync.mockImplementation(() => {
      throw new Error("spawn failed");
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    await runUpdateCommand();

    // Assert
    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("[la-briguade] Update failed: spawn failed");
  });

  it("should set exitCode and print timeout error when update is terminated", async () => {
    // Arrange
    process.exitCode = undefined;
    mockSpawnSync.mockReturnValue({ status: null, signal: "SIGTERM" } as never);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    await runUpdateCommand();

    // Assert
    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith("[la-briguade] Update timed out after 120 seconds.");
  });
});
