import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const LOG_LEVELS = ["off", "error", "warn", "info", "debug"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

const LOGGER_PREFIX = "[la-briguade]";

let currentLevel: LogLevel = "warn";
let logFilePath: string | undefined;

function getLogBaseDir(): string {
  const xdgDataHome = process.env["XDG_DATA_HOME"];
  const dataHome =
    typeof xdgDataHome === "string" && xdgDataHome.startsWith("/")
      ? xdgDataHome
      : join(homedir(), ".local", "share");

  return join(dataHome, "opencode", "log");
}

function toSessionTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, "").replace(/\..+/, "");
}

function isEnabledFor(level: Exclude<LogLevel, "off">): boolean {
  if (currentLevel === "off") return false;

  if (level === "error") {
    return true;
  }
  if (level === "warn") {
    return currentLevel === "warn" || currentLevel === "info" || currentLevel === "debug";
  }
  if (level === "info") {
    return currentLevel === "info" || currentLevel === "debug";
  }

  return currentLevel === "debug";
}

function writeLogLine(level: Exclude<LogLevel, "off">, message: string): void {
  if (!isEnabledFor(level)) return;
  if (logFilePath === undefined) return;

  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
  appendFileSync(logFilePath, line, "utf-8");
}

function logWarn(message: string): void {
  if (!isEnabledFor("warn")) return;
  console.warn(`${LOGGER_PREFIX} ${message}`);
  writeLogLine("warn", message);
}

function logError(message: string): void {
  if (!isEnabledFor("error")) return;
  console.error(`${LOGGER_PREFIX} ${message}`);
  writeLogLine("error", message);
}

function logInfo(message: string): void {
  writeLogLine("info", message);
}

function logDebug(message: string): void {
  writeLogLine("debug", message);
}

function setLevel(level: LogLevel): void {
  currentLevel = level;
}

function getLogFilePath(): string | undefined {
  return logFilePath;
}

export function initLogger(): void {
  currentLevel = "warn";
  const logDir = getLogBaseDir();
  try {
    mkdirSync(logDir, { recursive: true });
  } catch (error) {
    logFilePath = undefined;
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[la-briguade] Could not create log directory: ${message}`);
    return;
  }
  const timestamp = toSessionTimestamp(new Date());
  logFilePath = join(logDir, `la-briguade-${timestamp}.log`);
}

export function resetLogger(): void {
  currentLevel = "warn";
  logFilePath = undefined;
}

export const logger = {
  warn: logWarn,
  error: logError,
  info: logInfo,
  debug: logDebug,
  setLevel,
  getLogFilePath,
};
