import type { PluginInput } from "../../types/plugin.js";

import { logger } from "./logger.js";

type ToastVariant = "info" | "warning" | "error";

type ShowToastBody = {
  message: string;
  variant: ToastVariant;
  duration?: number;
};

type ShowToastPayload = {
  body: ShowToastBody;
};

type ShowToast = (payload: ShowToastPayload) => void;
type NotifyFallback = (msg: string) => void;

let showToast: ShowToast | undefined;

function resolveShowToast(ctx: PluginInput): ShowToast | undefined {
  // Undocumented API used by opencode-quota:
  // access through unknown record + full optional chaining.
  const maybeShowToast = (
    ctx as unknown as {
      client?: {
        tui?: {
          showToast?: unknown;
        };
      };
    }
  )?.client?.tui?.showToast;

  return typeof maybeShowToast === "function" ? (maybeShowToast as ShowToast) : undefined;
}

function emitOrFallback(
  message: string,
  variant: ToastVariant,
  fallback: NotifyFallback,
): void {
  try {
    showToast?.({
      body: {
        message,
        variant,
      },
    });
    if (showToast !== undefined) return;
  } catch {
    // Never throw from notifier; fallback below.
  }

  fallback(message);
}

export function initNotifier(ctx: PluginInput): void {
  showToast = resolveShowToast(ctx);
}

export const notifier = {
  warn(message: string): void {
    emitOrFallback(message, "warning", logger.warn);
  },
  error(message: string): void {
    emitOrFallback(message, "error", logger.error);
  },
  info(message: string): void {
    emitOrFallback(message, "info", logger.info);
  },
};
