import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { parse as parseJsonc, type ParseError } from "jsonc-parser";

import { LaBriguadeConfigSchema } from "./schema.js";
import type { LaBriguadeConfig } from "./schema.js";

/** Discriminated union describing why a config file could not be loaded. */
export type ConfigLoadError =
  | { kind: "not-found" }
  | { kind: "parse-error"; message: string }
  | { kind: "validation-error"; message: string };

/** Result type returned by {@link loadConfig}. */
export type ConfigLoadResult =
  | { ok: true; value: LaBriguadeConfig }
  | { ok: false; error: ConfigLoadError };

/**
 * Load and validate a la-briguade config file.
 *
 * The filePath must NOT include an extension. This function tries
 * filePath + ".json" first, then filePath + ".jsonc". Returns a
 * discriminated union result — never throws.
 */
export function loadConfig(filePath: string): ConfigLoadResult {
  const jsonPath = `${filePath}.json`;
  const jsoncPath = `${filePath}.jsonc`;

  let raw: string;
  let resolvedPath: string;

  const jsonExists = tryReadFile(jsonPath);
  if (jsonExists.ok) {
    raw = jsonExists.content;
    resolvedPath = jsonPath;
  } else {
    const jsoncExists = tryReadFile(jsoncPath);
    if (jsoncExists.ok) {
      raw = jsoncExists.content;
      resolvedPath = jsoncPath;
    } else {
      return { ok: false, error: { kind: "not-found" } };
    }
  }

  const fileName = basename(resolvedPath);

  // jsonc-parser does NOT throw on parse errors — it returns partial results
  // and populates the errors array. Check it explicitly.
  const parseErrors: ParseError[] = [];
  const parsed: unknown = parseJsonc(raw, parseErrors);

  if (parseErrors.length > 0) {
    return {
      ok: false,
      error: { kind: "parse-error", message: `${parseErrors.length} parse error(s)` },
    };
  }

  if (parsed === null || parsed === undefined) {
    return {
      ok: false,
      error: { kind: "parse-error", message: "file is empty or contains only null" },
    };
  }

  const result = LaBriguadeConfigSchema.safeParse(parsed);
  if (!result.success) {
    // Log issue count only — avoids leaking full schema/path details to console
    console.warn(
      `[la-briguade] Config validation failed (${fileName}): ` +
        `${result.error.issues.length} issue(s) found`,
    );
    return {
      ok: false,
      error: { kind: "validation-error", message: result.error.message },
    };
  }

  return { ok: true, value: result.data };
}

type ReadResult =
  | { ok: true; content: string }
  | { ok: false };

function tryReadFile(filePath: string): ReadResult {
  try {
    const content = readFileSync(filePath, "utf-8");
    return { ok: true, content };
  } catch {
    return { ok: false };
  }
}
