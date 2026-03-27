/**
 * Centralized logger facade.
 *
 * Routes to @tauri-apps/plugin-log when running inside Tauri,
 * falls back to formatted console calls in browser-only mode (pnpm dev) or tests.
 *
 * CRITICAL: The Tauri check happens at CALL TIME via dynamic import(),
 * not at import time. This ensures the module is safe to import in
 * Vitest/jsdom where window.__TAURI_INTERNALS__ is undefined.
 *
 * Format: [ATM] [LEVEL] [context] message (per D-04)
 */

type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

function isTauri(): boolean {
  return (
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  );
}

const CONSOLE_MAP: Record<LogLevel, keyof Console> = {
  trace: "log",
  debug: "log",
  info: "info",
  warn: "warn",
  error: "error",
};

async function log(
  level: LogLevel,
  context: string,
  message: string
): Promise<void> {
  const formatted = `[ATM] [${level.toUpperCase()}] [${context}] ${message}`;

  if (isTauri()) {
    try {
      // Lazy import — only resolves inside Tauri runtime
      const pluginLog = await import("@tauri-apps/plugin-log");
      await pluginLog[level](formatted);
    } catch {
      // If plugin-log fails for any reason, fall through to console
      (console[CONSOLE_MAP[level]] as (...args: unknown[]) => void)(formatted);
    }
  } else {
    (console[CONSOLE_MAP[level]] as (...args: unknown[]) => void)(formatted);
  }
}

export const logger = {
  trace: (context: string, message: string) => log("trace", context, message),
  debug: (context: string, message: string) => log("debug", context, message),
  info: (context: string, message: string) => log("info", context, message),
  warn: (context: string, message: string) => log("warn", context, message),
  error: (context: string, message: string) => log("error", context, message),
};
