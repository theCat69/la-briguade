import { describe, it, expect, vi, afterEach } from "vitest";

import { parseModelSections, resolveModelSection } from "./model-sections.js";

describe("parseModelSections", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return full body as base and empty sections when no headers are present", () => {
    // Arrange
    const body = "You are a helpful assistant.\nAlways be concise.";

    // Act
    const result = parseModelSections(body);

    // Assert
    expect(result.base).toBe(body.trim());
    expect(result.sections).toEqual({});
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
    expect(result.sections).toEqual({ claude: "Claude-specific instructions." });
  });

  it("should parse multiple sections into separate keys", () => {
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
    expect(result.sections).toEqual({
      claude: "Use Claude thinking.",
      gpt: "Use GPT structured output.",
      gemini: "Use Gemini grounding.",
    });
  });

  it("should parse lowercase section header as the correct family key", () => {
    // Arrange
    const body = "Base.\n====== claude ======\nLowercase section.";

    // Act
    const result = parseModelSections(body);

    // Assert
    expect(result.sections).toEqual({ claude: "Lowercase section." });
  });

  it("should warn and skip a section with an unknown family name", () => {
    // Arrange
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const body = [
      "Base.",
      "====== UNKNOWN ======",
      "This should be skipped.",
    ].join("\n");

    // Act
    const result = parseModelSections(body);

    // Assert
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      "[la-briguade] unknown model section family: 'unknown' in agent body — skipped",
    );
    expect(result.sections).toEqual({});
  });

  it("should trim leading and trailing whitespace from base and section texts", () => {
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
    expect(result.sections).toEqual({ grok: "Grok section." });
  });

  it("should return empty base and empty sections for an empty body", () => {
    // Arrange
    const body = "";

    // Act
    const result = parseModelSections(body);

    // Assert
    expect(result.base).toBe("");
    expect(result.sections).toEqual({});
  });

  it("should produce empty string section when header is immediately followed by next header", () => {
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

    // Assert — gpt section is empty string (trimmed whitespace-only content)
    expect(result.sections["gpt"]).toBe("");
    expect(result.sections["claude"]).toBe("Claude content.");
  });
});

describe("resolveModelSection", () => {
  it("should return claude section for a model ID that includes 'claude'", () => {
    // Arrange
    const sections = { claude: "Think step by step." };
    const modelId = "anthropic/claude-opus";

    // Act
    const result = resolveModelSection(sections, modelId);

    // Assert
    expect(result).toBe("Think step by step.");
  });

  it("should return claude section as fallback when model ID has no family match", () => {
    // Arrange
    const sections = { claude: "Claude fallback text." };
    // mistral does not match any of: claude, gpt, gemini, grok
    const modelId = "mistral/mistral-large";

    // Act
    const result = resolveModelSection(sections, modelId);

    // Assert
    expect(result).toBe("Claude fallback text.");
  });

  it("should return gpt section for a model ID that includes 'gpt'", () => {
    // Arrange
    const sections = { claude: "Claude section.", gpt: "GPT section." };
    const modelId = "openai/gpt-4o";

    // Act
    const result = resolveModelSection(sections, modelId);

    // Assert
    expect(result).toBe("GPT section.");
  });

  it("should return undefined when no family matches and no claude fallback exists", () => {
    // Arrange
    const sections = { gpt: "GPT section.", gemini: "Gemini section." };
    const modelId = "mistral/mistral-7b";

    // Act
    const result = resolveModelSection(sections, modelId);

    // Assert
    expect(result).toBeUndefined();
  });

  it("should match family name case-insensitively in model ID", () => {
    // Arrange
    const sections = { gemini: "Use Gemini grounding." };
    const modelId = "google/GEMINI-pro";

    // Act
    const result = resolveModelSection(sections, modelId);

    // Assert
    expect(result).toBe("Use Gemini grounding.");
  });

  it("should return undefined when the matched family section is an empty string", () => {
    // Arrange — gpt section exists but is empty; no claude fallback
    const sections = { gpt: "" };
    const modelId = "openai/gpt-4o";

    // Act
    const result = resolveModelSection(sections, modelId);

    // Assert — empty string must not be returned; treated as absent
    expect(result).toBeUndefined();
  });

  it("should fall through to claude fallback when matched family section is empty string", () => {
    // Arrange — gpt section is empty, claude fallback is non-empty
    const sections = { gpt: "", claude: "Claude fallback." };
    const modelId = "openai/gpt-4o";

    // Act
    const result = resolveModelSection(sections, modelId);

    // Assert — empty gpt section is skipped; claude fallback is used
    expect(result).toBe("Claude fallback.");
  });
});
