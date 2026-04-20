import { describe, expect, it } from "vitest";

import { isNodeError, isRecord } from "./type-guards.js";

describe("isRecord", () => {
  it("should return true for plain objects", () => {
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it("should return false for arrays and null", () => {
    expect(isRecord([1, 2, 3])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });

  it("should return false for primitive and undefined values", () => {
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord(0)).toBe(false);
    expect(isRecord("")).toBe(false);
    expect(isRecord(true)).toBe(false);
  });
});

describe("isNodeError", () => {
  it("should return true for Error objects with code", () => {
    const error = Object.assign(new Error("missing"), { code: "ENOENT" });
    expect(isNodeError(error)).toBe(true);
    if (isNodeError(error)) {
      expect(error.code).toBe("ENOENT");
    }
  });

  it("should return false for non-error values", () => {
    expect(isNodeError({ code: "ENOENT" })).toBe(false);
    expect(isNodeError("ENOENT")).toBe(false);
  });
});
