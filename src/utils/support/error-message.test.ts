import { describe, expect, it } from "vitest";

import {
  sanitizeControlCharacters,
  sanitizePrintableAscii,
  toErrorMessage,
  toSanitizedParseFailureReason,
} from "./error-message.js";

describe("toErrorMessage", () => {
  it("should return message for Error instances", () => {
    expect(toErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("should coerce non-Error values", () => {
    expect(toErrorMessage(42)).toBe("42");
  });
});

describe("sanitizeControlCharacters", () => {
  it("should replace control characters", () => {
    expect(sanitizeControlCharacters("bad\u0007line\n")).toBe("bad?line?");
  });
});

describe("sanitizePrintableAscii", () => {
  it("should replace non-printable ASCII characters", () => {
    expect(sanitizePrintableAscii("bad\u0007µ")).toBe("bad??");
  });
});

describe("toSanitizedParseFailureReason", () => {
  it("should sanitize and truncate error reason", () => {
    const reason = toSanitizedParseFailureReason(new Error("bad\u0007line"), 4);
    expect(reason).toBe("bad?");
  });
});
