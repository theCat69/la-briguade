import { afterEach, describe, expect, it, vi } from "vitest";

import { EventEmitter } from "node:events";

import { spawn, spawnSync } from "node:child_process";

import {
  resetCacheCtrlWatchStateForTests,
  startCacheCtrlWatch,
} from "./cache-ctrl-watch.js";
import { logger } from "./logger.js";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
  spawnSync: vi.fn(),
}));

vi.mock("./logger.js", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

const mockSpawn = vi.mocked(spawn);
const mockSpawnSync = vi.mocked(spawnSync);
const mockLoggerDebug = vi.mocked(logger.debug);
const mockLoggerWarn = vi.mocked(logger.warn);

function createChildProcessStub(): ReturnType<typeof spawn> {
  const processStub = new EventEmitter() as unknown as ReturnType<typeof spawn>;
  processStub.unref = vi.fn();
  return processStub;
}

describe("startCacheCtrlWatch", () => {
  afterEach(() => {
    resetCacheCtrlWatchStateForTests();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should start cache-ctrl watch once when binary is available", () => {
    // Arrange
    mockSpawnSync.mockReturnValue({ error: undefined } as ReturnType<typeof spawnSync>);
    const child = createChildProcessStub();
    mockSpawn.mockReturnValue(child);
    const projectDir = "/repo/project-a";

    // Act
    const firstStartResult = startCacheCtrlWatch(projectDir);
    const secondStartResult = startCacheCtrlWatch(projectDir);

    // Assert
    expect(firstStartResult).toBe(true);
    expect(secondStartResult).toBe(false);
    expect(mockSpawnSync).toHaveBeenCalledOnce();
    expect(mockSpawnSync).toHaveBeenCalledWith("cache-ctrl", ["--version"], {
      stdio: "ignore",
      timeout: 500,
    });
    expect(mockSpawn).toHaveBeenCalledOnce();
    expect(mockSpawn).toHaveBeenCalledWith("cache-ctrl", ["watch"], {
      cwd: projectDir,
      detached: false,
      stdio: "ignore",
    });
    expect(child.unref).toHaveBeenCalledOnce();
    expect(mockLoggerDebug).toHaveBeenCalledWith("started cache-ctrl watch background process");
  });

  it("should skip startup when cache-ctrl CLI is missing", () => {
    // Arrange
    mockSpawnSync.mockReturnValue({ error: new Error("ENOENT") } as ReturnType<typeof spawnSync>);

    // Act
    const started = startCacheCtrlWatch("/repo/project-a");

    // Assert
    expect(started).toBe(false);
    expect(mockSpawn).not.toHaveBeenCalled();
    expect(mockLoggerDebug).toHaveBeenCalledWith(
      "cache-ctrl CLI not available; skipping watch startup",
    );
  });

  it("should keep startup non-fatal when spawn throws", () => {
    // Arrange
    mockSpawnSync.mockReturnValue({ error: undefined } as ReturnType<typeof spawnSync>);
    mockSpawn.mockImplementation(() => {
      throw new Error("spawn failed");
    });

    // Act
    const started = startCacheCtrlWatch("/repo/project-a");

    // Assert
    expect(started).toBe(false);
    expect(mockLoggerWarn).toHaveBeenCalledWith("failed to start cache-ctrl watch: spawn failed");
  });

  it("should allow retry after asynchronous child startup error", () => {
    // Arrange
    mockSpawnSync.mockReturnValue({ error: undefined } as ReturnType<typeof spawnSync>);
    const firstChild = createChildProcessStub();
    const secondChild = createChildProcessStub();
    mockSpawn.mockReturnValueOnce(firstChild).mockReturnValueOnce(secondChild);
    const projectDir = "/repo/project-a";

    // Act
    const firstStartResult = startCacheCtrlWatch(projectDir);
    firstChild.emit("error", new Error("async spawn error"));
    const retryStartResult = startCacheCtrlWatch(projectDir);

    // Assert
    expect(firstStartResult).toBe(true);
    expect(retryStartResult).toBe(true);
    expect(mockSpawn).toHaveBeenCalledTimes(2);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "cache-ctrl watch process error: async spawn error",
    );
  });

  it("should keep startup guard scoped per workspace", () => {
    // Arrange
    mockSpawnSync.mockReturnValue({ error: undefined } as ReturnType<typeof spawnSync>);
    const firstWorkspaceChild = createChildProcessStub();
    const secondWorkspaceChild = createChildProcessStub();
    mockSpawn
      .mockReturnValueOnce(firstWorkspaceChild)
      .mockReturnValueOnce(secondWorkspaceChild);

    // Act
    const firstWorkspaceStart = startCacheCtrlWatch("/repo/project-a");
    const secondWorkspaceStart = startCacheCtrlWatch("/repo/project-b");

    // Assert
    expect(firstWorkspaceStart).toBe(true);
    expect(secondWorkspaceStart).toBe(true);
    expect(mockSpawn).toHaveBeenCalledTimes(2);
    expect(mockSpawn).toHaveBeenNthCalledWith(1, "cache-ctrl", ["watch"], {
      cwd: "/repo/project-a",
      detached: false,
      stdio: "ignore",
    });
    expect(mockSpawn).toHaveBeenNthCalledWith(2, "cache-ctrl", ["watch"], {
      cwd: "/repo/project-b",
      detached: false,
      stdio: "ignore",
    });
  });
});
