import { describe, it, expect, vi, afterEach } from "vitest";

import { parseModelSections, resolveModelSection } from "./model-sections.js";
import type { ModelSegment } from "./model-sections.js";
import { logger } from "./logger.js";

vi.mock("./logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const mockLoggerWarn = vi.mocked(logger.warn);

describe("parseModelSections", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should return full body as base and empty segments when no headers are present", () => {
    // Arrange
    const body = "You are a helpful assistant.\nAlways be concise.";

    // Act
    const result = parseModelSections(body);

    // Assert
    expect(result.base).toBe(body.trim());
    expect(result.segments).toEqual([]);
  });

  it("should parse a CLAUDE section and leave text before it as base", () => {
    // Arrange
    const body = [
      "Base prompt text.",
      "",
      "====== CLAUDE ======",
      "Claude-specific instructions.",
    ].join("\n");

    // Act
    const result = parseModelSections(body);

    // Assert
    expect(result.base).toBe("Base prompt text.");
    expect(result.segments).toEqual([
      { target: "claude", text: "Claude-specific instructions." },
    ]);
  });

  it("should parse multiple sections in document order", () => {
    // Arrange
    const body = [
      "Shared base.",
      "",
      "====== CLAUDE ======",
      "Use Claude thinking.",
      "",
      "====== GPT ======",
      "Use GPT structured output.",
      "",
      "====== GEMINI ======",
      "Use Gemini grounding.",
    ].join("\n");

    // Act
    const result = parseModelSections(body);

    // Assert
    expect(result.base).toBe("Shared base.");
    expect(result.segments).toEqual([
      { target: "claude", text: "Use Claude thinking." },
      { target: "gpt", text: "Use GPT structured output." },
      { target: "gemini", text: "Use Gemini grounding." },
    ]);
  });

  it("should parse ALL header into an all-model segment in document order", () => {
    // Arrange
    const body = [
      "Shared base.",
      "",
      "====== GPT ======",
      "GPT first.",
      "",
      "====== ALL ======",
      "Everyone.",
      "",
      "====== CLAUDE ======",
      "Claude later.",
    ].join("\n");

    // Act
    const result = parseModelSections(body);

    // Assert
    expect(result.segments).toEqual([
      { target: "gpt", text: "GPT first." },
      { target: "all", text: "Everyone." },
      { target: "claude", text: "Claude later." },
    ]);
  });

  it("should parse lowercase section header as the correct target", () => {
    // Arrange
    const body = "Base.\n====== claude ======\nLowercase section.";

    // Act
    const result = parseModelSections(body);

    // Assert
    expect(result.segments).toEqual([
      { target: "claude", text: "Lowercase section." },
    ]);
  });

  it("should warn and skip a section with an unknown family name", () => {
    // Arrange
    const body = [
      "Base.",
      "====== UNKNOWN ======",
      "This should be skipped.",
    ].join("\n");

    // Act
    const result = parseModelSections(body);

    // Assert
    expect(mockLoggerWarn).toHaveBeenCalledOnce();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "unknown model section family: 'unknown' in agent body — skipped",
    );
    expect(result.segments).toEqual([]);
  });

  it("should trim leading and trailing whitespace from base and segment texts", () => {
    // Arrange
    const body = [
      "  Base with spaces.  ",
      "",
      "====== GROK ======",
      "",
      "  Grok section.  ",
      "",
    ].join("\n");

    // Act
    const result = parseModelSections(body);

    // Assert
    expect(result.base).toBe("Base with spaces.");
    expect(result.segments).toEqual([{ target: "grok", text: "Grok section." }]);
  });

  it("should return empty base and empty segments for an empty body", () => {
    // Arrange
    const body = "";

    // Act
    const result = parseModelSections(body);

    // Assert
    expect(result.base).toBe("");
    expect(result.segments).toEqual([]);
  });

  it("should keep empty text when header is immediately followed by next header", () => {
    // Arrange — GPT header has no content before the next header
    const body = [
      "Base prompt.",
      "",
      "====== GPT ======",
      "====== CLAUDE ======",
      "Claude content.",
    ].join("\n");

    // Act
    const result = parseModelSections(body);

    // Assert
    expect(result.segments[0]).toEqual({ target: "gpt", text: "" });
    expect(result.segments[1]).toEqual({ target: "claude", text: "Claude content." });
  });

  it("should cap parsed model segments at MAX_SEGMENTS and warn once", () => {
    // Arrange
    const lines = ["Base prompt."];
    for (let i = 0; i < 51; i += 1) {
      lines.push("====== GPT ======");
      lines.push(`Section ${i + 1}`);
    }
    const body = lines.join("\n");

    // Act
    const result = parseModelSections(body);

    // Assert
    expect(result.segments).toHaveLength(50);
    expect(result.segments[49]).toEqual({ target: "gpt", text: "Section 50" });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "model section count exceeded MAX_SEGMENTS=50; remaining sections skipped",
    );
  });
});

describe("resolveModelSection", () => {
  it("should return claude section for a model ID that includes 'claude'", () => {
    // Arrange
    const segments = [{ target: "claude", text: "Think step by step." }] as const;
    const modelId = "anthropic/claude-opus";

    // Act
    const result = resolveModelSection([...segments], modelId);

    // Assert
    expect(result).toBe("Think step by step.");
  });

  it("should return 'C\\n\\nA' for claude with claude and all segments", () => {
    // Arrange
    const segments = [
      { target: "claude", text: "C" },
      { target: "all", text: "A" },
    ] satisfies ModelSegment[];

    // Act
    const result = resolveModelSection(segments, "anthropic/claude-3-7-sonnet");

    // Assert
    expect(result).toBe("C\n\nA");
  });

  it("should return gpt and all segments in order for a gpt model", () => {
    // Arrange
    const segments = [
      { target: "gpt", text: "G1" },
      { target: "all", text: "A" },
      { target: "gpt", text: "G2" },
    ] satisfies ModelSegment[];

    // Act
    const result = resolveModelSection(segments, "openai/gpt-4o");

    // Assert
    expect(result).toBe("G1\n\nA\n\nG2");
  });

  it("should return all segments for gemini when no family section exists", () => {
    // Arrange
    const segments = [{ target: "all", text: "A" }] satisfies ModelSegment[];

    // Act
    const result = resolveModelSection(segments, "google/gemini-pro");

    // Assert
    expect(result).toBe("A");
  });

  it("should keep backward compatibility for claude without ALL keyword", () => {
    // Arrange
    const segments = [{ target: "claude", text: "C" }] satisfies ModelSegment[];

    // Act
    const result = resolveModelSection(segments, "anthropic/claude-opus");

    // Assert
    expect(result).toBe("C");
  });

  it("should use claude fallback for unknown model only", () => {
    // Arrange
    const segments = [{ target: "claude", text: "C" }] satisfies ModelSegment[];

    // Act
    const unknownModelResult = resolveModelSection(segments, "mistral");
    const knownModelResult = resolveModelSection(segments, "openai/gpt-4o");

    // Assert
    expect(unknownModelResult).toBe("C");
    expect(knownModelResult).toBeUndefined();
  });

  it("should return only all segment for unknown model when ALL exists", () => {
    // Arrange
    const segments = [
      { target: "claude", text: "C" },
      { target: "all", text: "A" },
    ] satisfies ModelSegment[];

    // Act
    const result = resolveModelSection(segments, "mistral");

    // Assert
    expect(result).toBe("A");
  });

  it("should handle same family twice and include all in-between", () => {
    // Arrange
    const segments = [
      { target: "claude", text: "C1" },
      { target: "all", text: "A" },
      { target: "claude", text: "C2" },
    ] satisfies ModelSegment[];

    // Act
    const claudeResult = resolveModelSection(segments, "anthropic/claude-opus");
    const geminiResult = resolveModelSection(segments, "google/gemini-pro");

    // Assert
    expect(claudeResult).toBe("C1\n\nA\n\nC2");
    expect(geminiResult).toBe("A");
  });

  it("should prefer the first KNOWN_FAMILIES match when model ID matches multiple families", () => {
    // Arrange — model id contains both 'claude' and 'gpt'; claude is matched first
    const segments = [
      { target: "claude", text: "Claude section." },
      { target: "gpt", text: "GPT section." },
    ] satisfies ModelSegment[];
    const modelId = "vendor/claude-gpt-hybrid";

    // Act
    const result = resolveModelSection(segments, modelId);

    // Assert
    expect(result).toBe("Claude section.");
  });

  it("should return undefined when no match and no claude fallback exist", () => {
    // Arrange
    const segments = [
      { target: "gpt", text: "GPT section." },
      { target: "gemini", text: "Gemini section." },
    ] satisfies ModelSegment[];
    const modelId = "mistral/mistral-7b";

    // Act
    const result = resolveModelSection(segments, modelId);

    // Assert
    expect(result).toBeUndefined();
  });

  it("should match family name case-insensitively in model ID", () => {
    // Arrange
    const segments = [
      { target: "gemini", text: "Use Gemini grounding." },
    ] satisfies ModelSegment[];
    const modelId = "google/GEMINI-pro";

    // Act
    const result = resolveModelSection(segments, modelId);

    // Assert
    expect(result).toBe("Use Gemini grounding.");
  });

  it("should return undefined when included segments are empty after trim", () => {
    // Arrange — matched family segment exists but is empty after trim
    const segments = [{ target: "gpt", text: "   " }] satisfies ModelSegment[];
    const modelId = "openai/gpt-4o";

    // Act
    const result = resolveModelSection(segments, modelId);

    // Assert
    expect(result).toBeUndefined();
  });

  it("should return undefined when matched family segment is empty", () => {
    // Arrange — gpt segment empty, claude is ignored for known family, no ALL segments
    const segments = [
      { target: "gpt", text: "" },
      { target: "claude", text: "Claude fallback." },
    ] satisfies ModelSegment[];
    const modelId = "openai/gpt-4o";

    // Act
    const result = resolveModelSection(segments, modelId);

    // Assert
    expect(result).toBeUndefined();
  });
});
