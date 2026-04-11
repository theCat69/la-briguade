import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./logger.js", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import type { PluginInput } from "../types/plugin.js";

import { logger } from "./logger.js";
import { initNotifier, notifier, resetNotifier } from "./notifier.js";

describe("notifier", () => {
  afterEach(() => {
    resetNotifier();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("should call showToast with warning variant when tui is available", () => {
    // Arrange
    const showToast = vi.fn();
    const ctx = {
      client: {
        tui: {
          showToast,
        },
      },
    } as unknown as PluginInput;
    initNotifier(ctx);

    // Act
    notifier.warn("watch out");

    // Assert
    expect(showToast).toHaveBeenCalledWith({
      body: {
        message: "watch out",
        variant: "warning",
      },
    });
  });

  it("should fallback to logger.warn when tui is unavailable", () => {
    // Arrange
    const mockWarn = vi.mocked(logger.warn);
    mockWarn.mockClear();
    initNotifier({} as PluginInput);

    // Act
    notifier.warn("fallback warning");

    // Assert
    expect(mockWarn).toHaveBeenCalledWith("fallback warning");
  });

  it("should call showToast with error variant", () => {
    // Arrange
    const showToast = vi.fn();
    initNotifier({ client: { tui: { showToast } } } as unknown as PluginInput);

    // Act
    notifier.error("failure");

    // Assert
    expect(showToast).toHaveBeenCalledWith({
      body: {
        message: "failure",
        variant: "error",
      },
    });
  });

  it("should call showToast with info variant", () => {
    // Arrange
    const showToast = vi.fn();
    initNotifier({ client: { tui: { showToast } } } as unknown as PluginInput);

    // Act
    notifier.info("hello");

    // Assert
    expect(showToast).toHaveBeenCalledWith({
      body: {
        message: "hello",
        variant: "info",
      },
    });
  });

  it("should clear notifier state on resetNotifier", () => {
    // Arrange
    const showToast = vi.fn();
    const mockWarn = vi.mocked(logger.warn);
    mockWarn.mockClear();
    initNotifier({ client: { tui: { showToast } } } as unknown as PluginInput);
    resetNotifier();

    // Act
    notifier.warn("after reset");

    // Assert
    expect(showToast).not.toHaveBeenCalled();
    expect(mockWarn).toHaveBeenCalledWith("after reset");
  });
});
