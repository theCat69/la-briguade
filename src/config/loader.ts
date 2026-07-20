import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { parse as parseJsonc, type ParseError } from "jsonc-parser";

import { LaBriguadeConfigSchema } from "./schema.js";
import type { LaBriguadeConfig } from "./schema.js";
import { logger } from "../utils/runtime/logger.js";
import { isNodeError } from "../utils/support/type-guards.js";

/** Discriminated union describing why a config file could not be loaded. */
export type ConfigLoadError =
  | { kind: "not-found" }
  | { kind: "parse-error"; message: string }
  | { kind: "validation-error"; message: string };

/** Result type returned by {@link loadConfig}. */
export type ConfigLoadResult =
  | { ok: true; value: LaBriguadeConfig }
  | { ok: false; error: ConfigLoadError };

export interface ConfigLoadInspection {
  searchedPaths: [string, string];
  resolvedPath?: string;
  result: ConfigLoadResult;
}

/**
 * Load and validate a la-briguade config file.
 *
 * The filePath must NOT include an extension. This function tries
 * filePath + ".json" first, then filePath + ".jsonc". Returns a
 * discriminated union result — never throws.
 */
export function loadConfig(filePath: string): ConfigLoadResult {
  return inspectConfigLoad(filePath).result;
}

export function inspectConfigLoad(filePath: string): ConfigLoadInspection {
  const jsonPath = `${filePath}.json`;
  const jsoncPath = `${filePath}.jsonc`;

  logger.debug(
    `Checking la-briguade config candidates: '${jsonPath}', '${jsoncPath}'`,
  );

  let raw: string;
  let resolvedPath: string;

  const jsonExists = tryReadFile(jsonPath);
  if (jsonExists.ok) {
    raw = jsonExists.content;
    resolvedPath = jsonPath;
  } else {
    if (jsonExists.code === "read-error") {
      logger.warn(`Could not read config file '${jsonPath}': ${jsonExists.message}`);
    }

    const jsoncExists = tryReadFile(jsoncPath);
    if (jsoncExists.ok) {
      raw = jsoncExists.content;
      resolvedPath = jsoncPath;
    } else {
      if (jsoncExists.code === "read-error") {
        logger.warn(`Could not read config file '${jsoncPath}': ${jsoncExists.message}`);
      }
      logger.debug(`No la-briguade config found for base path '${filePath}'`);
      return {
        searchedPaths: [jsonPath, jsoncPath],
        result: { ok: false, error: { kind: "not-found" } },
      };
    }
  }

  logger.debug(`Loaded la-briguade config from '${resolvedPath}'`);

  // jsonc-parser does NOT throw on parse errors — it returns partial results
  // and populates the errors array. Check it explicitly.
  const parseErrors: ParseError[] = [];
  const parsed: unknown = parseJsonc(raw, parseErrors);

  if (parseErrors.length > 0) {
    logger.warn(
      `Config parse failed (${basename(resolvedPath)}): ${parseErrors.length} parse error(s)`,
    );
    return {
      searchedPaths: [jsonPath, jsoncPath],
      resolvedPath,
      result: {
        ok: false,
        error: { kind: "parse-error", message: `${parseErrors.length} parse error(s)` },
      },
    };
  }

  if (parsed === null || parsed === undefined) {
    logger.warn(`Config parse failed (${basename(resolvedPath)}): file is empty or contains only null`);
    return {
      searchedPaths: [jsonPath, jsoncPath],
      resolvedPath,
      result: {
        ok: false,
        error: { kind: "parse-error", message: "file is empty or contains only null" },
      },
    };
  }

  const result = LaBriguadeConfigSchema.safeParse(parsed);
  if (!result.success) {
    // Log issue count only — avoids leaking full schema/path details to console
    logger.warn(
      `Config validation failed (${basename(resolvedPath)}): ` +
        `${result.error.issues.length} issue(s) found`,
    );
    return {
      searchedPaths: [jsonPath, jsoncPath],
      resolvedPath,
      result: {
        ok: false,
        error: { kind: "validation-error", message: result.error.message },
      },
    };
  }

  return {
    searchedPaths: [jsonPath, jsoncPath],
    resolvedPath,
    result: { ok: true, value: result.data },
  };
}

type ReadResult =
  | { ok: true; content: string }
  | { ok: false; code: "not-found" }
  | { ok: false; code: "read-error"; message: string };

function tryReadFile(filePath: string): ReadResult {
  try {
    const content = readFileSync(filePath, "utf-8");
    return { ok: true, content };
  } catch (error) {
    if (isNodeError(error) && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
      return { ok: false, code: "not-found" };
    }

    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, code: "read-error", message: reason };
  }
}
