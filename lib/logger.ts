import * as Sentry from "@sentry/nextjs";
type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function redact(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as LogContext).map(([key, entry]) => [
      key,
      /token|secret|key|password|authorization|cookie/i.test(key)
        ? "[redacted]"
        : entry
    ])
  );
}

export function log(
  level: LogLevel,
  message: string,
  context: LogContext = {}
) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    environment:
      process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    service: "syntrix-ai",
    ...(redact(context) as LogContext)
  };

  if (level === "error") {
    Sentry.captureMessage(message, {
      level: "error",
      extra: payload
    });
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === "warn") {
    Sentry.captureMessage(message, {
      level: "warning",
      extra: payload
    });
    console.warn(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}

export const logger = {
  debug: (message: string, context?: LogContext) =>
    log("debug", message, context),
  info: (message: string, context?: LogContext) =>
    log("info", message, context),
  warn: (message: string, context?: LogContext) =>
    log("warn", message, context),
  error: (message: string, context?: LogContext) =>
    log("error", message, context)
};
