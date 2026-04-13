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
import { initNotifier, notifier } from "./notifier.js";

describe("notifier", () => {
  afterEach(() => {
    initNotifier({} as PluginInput);
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

  it("should fallback to logger.warn when showToast throws", () => {
    // Arrange
    const showToast = vi.fn(() => {
      throw new Error("toast failed");
    });
    const mockWarn = vi.mocked(logger.warn);
    initNotifier({ client: { tui: { showToast } } } as unknown as PluginInput);

    // Act
    notifier.warn("warn after throw");

    // Assert
    expect(showToast).toHaveBeenCalledOnce();
    expect(mockWarn).toHaveBeenCalledWith("warn after throw");
  });

  it("should fallback to logger.error when tui is unavailable", () => {
    // Arrange
    const mockError = vi.mocked(logger.error);
    initNotifier({} as PluginInput);

    // Act
    notifier.error("fallback error");

    // Assert
    expect(mockError).toHaveBeenCalledWith("fallback error");
  });

  it("should fallback to logger.info when tui is unavailable", () => {
    // Arrange
    const mockInfo = vi.mocked(logger.info);
    initNotifier({} as PluginInput);

    // Act
    notifier.info("fallback info");

    // Assert
    expect(mockInfo).toHaveBeenCalledWith("fallback info");
  });

  it("should clear notifier state when reinitialized without tui", () => {
    // Arrange
    const showToast = vi.fn();
    const mockWarn = vi.mocked(logger.warn);
    initNotifier({ client: { tui: { showToast } } } as unknown as PluginInput);
    initNotifier({} as PluginInput);

    // Act
    notifier.warn("after reset");

    // Assert
    expect(showToast).not.toHaveBeenCalled();
    expect(mockWarn).toHaveBeenCalledWith("after reset");
  });
});
