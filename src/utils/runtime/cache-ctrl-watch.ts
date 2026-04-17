import { spawn, spawnSync } from "node:child_process";

import { sanitizeControlCharacters, toErrorMessage } from "../support/error-message.js";
import { logger } from "./logger.js";

const CACHE_CTRL_VERSION_CHECK_TIMEOUT_MS = 500;

interface WorkspaceWatchState {
  readonly hasStarted: boolean;
  readonly isStarting: boolean;
}

const watchStateByWorkspace = new Map<string, WorkspaceWatchState>();

function toSafeErrorMessage(error: unknown): string {
  return sanitizeControlCharacters(toErrorMessage(error));
}

function isCacheCtrlAvailable(): boolean {
  try {
    const result = spawnSync("cache-ctrl", ["--version"], {
      stdio: "ignore",
      timeout: CACHE_CTRL_VERSION_CHECK_TIMEOUT_MS,
    });
    return result.error == null;
  } catch (error) {
    logger.debug(
      `cache-ctrl watch startup check failed unexpectedly: ${toSafeErrorMessage(error)}`,
    );
    return false;
  }
}

function getWorkspaceState(projectDir: string): WorkspaceWatchState {
  return watchStateByWorkspace.get(projectDir) ?? { hasStarted: false, isStarting: false };
}

function setWorkspaceState(projectDir: string, state: WorkspaceWatchState): void {
  watchStateByWorkspace.set(projectDir, state);
}

/**
 * Starts `cache-ctrl watch` once per process when available.
 *
 * Startup failures are non-fatal and logged as diagnostics.
 */
export function startCacheCtrlWatch(projectDir: string = process.cwd()): boolean {
  const currentState = getWorkspaceState(projectDir);
  if (currentState.hasStarted || currentState.isStarting) {
    return false;
  }

  if (!isCacheCtrlAvailable()) {
    logger.debug("cache-ctrl CLI not available; skipping watch startup");
    return false;
  }

  setWorkspaceState(projectDir, { hasStarted: false, isStarting: true });

  try {
    const child = spawn("cache-ctrl", ["watch"], {
      cwd: projectDir,
      detached: false,
      stdio: "ignore",
    });
    child.once("error", (error) => {
      setWorkspaceState(projectDir, { hasStarted: false, isStarting: false });
      logger.warn(`cache-ctrl watch process error: ${toSafeErrorMessage(error)}`);
    });
    child.unref();
    setWorkspaceState(projectDir, { hasStarted: true, isStarting: false });
    logger.debug("started cache-ctrl watch background process");
    return true;
  } catch (error) {
    setWorkspaceState(projectDir, { hasStarted: false, isStarting: false });
    logger.warn(`failed to start cache-ctrl watch: ${toSafeErrorMessage(error)}`);
    return false;
  }
}

export function resetCacheCtrlWatchStateForTests(): void {
  watchStateByWorkspace.clear();
}
