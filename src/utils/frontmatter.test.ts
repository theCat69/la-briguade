import { afterEach, describe, expect, it, vi } from "vitest";

import { parseFrontmatter } from "./frontmatter.js";
import { logger } from "./logger.js";

vi.mock("./logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const mockLoggerWarn = vi.mocked(logger.warn);

describe("parseFrontmatter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return empty attributes and original body when opening fence is unclosed", () => {
    // Arrange
    const input = ["---", "title: Agent", "Body without closing fence"].join("\n");

    // Act
    const result = parseFrontmatter(input);

    // Assert
    expect(result.attributes).toEqual({});
    expect(result.body).toBe(input);
  });

  it("should return empty attributes and empty body when YAML parsing fails", () => {
    // Arrange
    const input = [
      "---",
      "title: [broken",
      "---",
      "Body should be dropped on parse failure",
    ].join("\n");

    // Act
    const result = parseFrontmatter(input);

    // Assert
    expect(mockLoggerWarn).toHaveBeenCalledOnce();
    expect(result.attributes).toEqual({});
    expect(result.body).toBe("");
  });

  it("should return empty attributes for valid non-object YAML scalar", () => {
    // Arrange
    const input = ["---", "42", "---", "Scalar frontmatter body"].join("\n");

    // Act
    const result = parseFrontmatter(input);

    // Assert
    expect(result.attributes).toEqual({});
    expect(result.body).toBe("Scalar frontmatter body");
  });

  it("should return empty attributes and empty body for empty input", () => {
    // Arrange
    const input = "";

    // Act
    const result = parseFrontmatter(input);

    // Assert
    expect(result.attributes).toEqual({});
    expect(result.body).toBe("");
  });

  it("should parse frontmatter attributes and return trimmed body", () => {
    // Arrange
    const input = [
      "---",
      "name: coder",
      "temperature: 0.2",
      "permission:",
      "  bash: allow",
      "---",
      "You are the coding agent.",
    ].join("\n");

    // Act
    const result = parseFrontmatter(input);

    // Assert
    expect(result.attributes).toEqual({
      name: "coder",
      temperature: 0.2,
      permission: { bash: "allow" },
    });
    expect(result.body).toBe("You are the coding agent.");
  });

  it("should parse frontmatter when leading whitespace precedes opening fence", () => {
    // Arrange
    const input = "\n  ---\nkey: val\n---\nbody";

    // Act
    const result = parseFrontmatter(input);

    // Assert
    expect(result.attributes).toEqual({ key: "val" });
    expect(result.body).toBe("body");
  });
});
