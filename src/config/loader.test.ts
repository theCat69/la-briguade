import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("node:fs");

import { readFileSync } from "node:fs";
import { loadConfig } from "./loader.js";

const mockReadFileSync = vi.mocked(readFileSync);

const VALID_CONFIG_JSON = JSON.stringify({
  agents: {
    coder: {
      model: "anthropic/claude-opus-4",
      temperature: 0.2,
    },
  },
});

const VALID_CONFIG_WITH_MODEL_JSON = JSON.stringify({
  model: "anthropic/claude-opus-4",
  agents: {
    coder: { systemPromptSuffix: "Always use PNPM." },
  },
});

const JSONC_WITH_COMMENTS = `{
  // This is a JSONC comment
  "model": "openai/gpt-4o",
  "agents": {
    /* block comment */
    "coder": {
      "temperature": 0.5
    }
  }
}`;

describe("loadConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return not-found when neither .json nor .jsonc exist", () => {
    // Arrange
    mockReadFileSync.mockImplementation(() => {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    // Act
    const result = loadConfig("/home/user/la-briguade");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("not-found");
    }
  });

  it("should return parse-error when file content parses to null", () => {
    // Arrange — jsonc-parser returns null for "null" literal content,
    // which our loader treats as a parse-error (empty/invalid file)
    mockReadFileSync.mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith(".json")) return "null";
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    // Act
    const result = loadConfig("/home/user/la-briguade");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("parse-error");
    }
  });

  it("should return parse-error on genuinely malformed JSON content", () => {
    // Arrange — "{bad:" is truly malformed (missing value + closing brace)
    // and causes jsonc-parser to populate its errors array
    mockReadFileSync.mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith(".json")) return "{bad:";
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    // Act
    const result = loadConfig("/home/user/la-briguade");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("parse-error");
    }
  });

  it("should return validation-error when JSON is valid but fails Zod schema", () => {
    // Arrange — temperature must be a number, not a string
    const invalidConfig = JSON.stringify({
      agents: { coder: { temperature: "hot" } },
    });
    mockReadFileSync.mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith(".json")) return invalidConfig;
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    // Act
    const result = loadConfig("/home/user/la-briguade");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation-error");
    }
  });

  it("should return ok with parsed config on valid .json", () => {
    // Arrange
    mockReadFileSync.mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith(".json")) return VALID_CONFIG_JSON;
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    // Act
    const result = loadConfig("/home/user/la-briguade");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.agents?.["coder"]?.model).toBe("anthropic/claude-opus-4");
      expect(result.value.agents?.["coder"]?.temperature).toBe(0.2);
    }
  });

  it("should return ok with parsed JSONC (with comments stripped) on valid .jsonc", () => {
    // Arrange — .json throws, .jsonc returns content with comments
    mockReadFileSync.mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith(".json")) {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }
      if (p.endsWith(".jsonc")) return JSONC_WITH_COMMENTS;
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    // Act
    const result = loadConfig("/home/user/la-briguade");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.model).toBe("openai/gpt-4o");
      expect(result.value.agents?.["coder"]?.temperature).toBe(0.5);
    }
  });

  it("should return ok with top-level model field", () => {
    // Arrange
    mockReadFileSync.mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith(".json")) return VALID_CONFIG_WITH_MODEL_JSON;
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    // Act
    const result = loadConfig("/home/user/la-briguade");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.model).toBe("anthropic/claude-opus-4");
      expect(result.value.agents?.["coder"]?.systemPromptSuffix).toBe("Always use PNPM.");
    }
  });

  it("should use .json over .jsonc when both exist", () => {
    // Arrange — both paths return valid configs with distinct model values
    mockReadFileSync.mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith(".json")) return JSON.stringify({ model: "from-json" });
      if (p.endsWith(".jsonc")) return JSON.stringify({ model: "from-jsonc" });
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    // Act
    const result = loadConfig("/home/user/la-briguade");

    // Assert — .json takes priority
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.model).toBe("from-json");
    }
  });

  it("should parse opus_enabled: true correctly", () => {
    // Arrange
    mockReadFileSync.mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith(".json")) return JSON.stringify({ opus_enabled: true });
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    // Act
    const result = loadConfig("/home/user/la-briguade");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.opus_enabled).toBe(true);
    }
  });

  it("should parse opus_enabled: false correctly", () => {
    // Arrange
    mockReadFileSync.mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith(".json")) return JSON.stringify({ opus_enabled: false });
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    // Act
    const result = loadConfig("/home/user/la-briguade");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.opus_enabled).toBe(false);
    }
  });

  it("should resolve opus_enabled to undefined when field is absent", () => {
    // Arrange — config with no opus_enabled field
    mockReadFileSync.mockImplementation((path) => {
      const p = String(path);
      if (p.endsWith(".json")) return JSON.stringify({ model: "anthropic/claude-sonnet-4.6" });
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    // Act
    const result = loadConfig("/home/user/la-briguade");

    // Assert — field absent means undefined, NOT false (default applied at consumption)
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.opus_enabled).toBeUndefined();
    }
  });
});
