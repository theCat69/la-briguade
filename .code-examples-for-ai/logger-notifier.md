<!-- Pattern: logger-notifier — Process-wide logger singleton with two-phase init and notifier fallback to logger -->

```typescript
// src/utils/logger.ts + src/utils/notifier.ts
// Demonstrates:
//   1. Two-phase logger initialization: init early, setLevel after config resolves
//   2. Session log path at XDG_DATA_HOME (or ~/.local/share) with timestamped filename
//   3. Level-gated console behavior (warn/error to console + file, info/debug file only)
//   4. UI toast notifier that safely uses undocumented ctx.client?.tui?.showToast
//   5. Guaranteed fallback to logger for non-UI contexts

import type { PluginInput } from "../types/plugin.js";

export type LogLevel = "off" | "error" | "warn" | "info" | "debug";

let level: LogLevel = "warn";
let logFilePath: string | undefined;

export function initLogger(): void {
  level = "warn";
  logFilePath = "/.../opencode/log/la-briguade-2026-04-11T083000.log";
}

export const logger = {
  setLevel(next: LogLevel): void {
    level = next;
  },
  warn(message: string): void {
    if (level === "off") return;
    console.warn(`[la-briguade] ${message}`);
    // appendFileSync(logFilePath, `[ISO] [WARN] ${message}\n`)
  },
};

type ShowToast = (payload: {
  body: { message: string; variant: "info" | "warning" | "error"; duration?: number };
}) => void;

let showToast: ShowToast | undefined;

export function initNotifier(ctx: PluginInput): void {
  const raw = ctx as unknown as Record<string, unknown>;
  const maybeShowToast = (raw["client"] as Record<string, unknown> | undefined)?.["tui"] as
    | Record<string, unknown>
    | undefined;
  const fn = maybeShowToast?.["showToast"];
  showToast = typeof fn === "function" ? (fn as ShowToast) : undefined;
}

export const notifier = {
  warn(message: string): void {
    try {
      showToast?.({ body: { message, variant: "warning" } });
      if (showToast !== undefined) return;
    } catch {
      // Never throw from notifier path.
    }
    logger.warn(message);
  },
};
```
