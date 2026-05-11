import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import { sendCriticalAlert } from "@/lib/monitoring/alerts";

export type ErrorCategory =
  | "api"
  | "openai"
  | "supabase"
  | "paypal"
  | "abuse"
  | "generation"
  | "unknown";

export type LoggedError = {
  category: ErrorCategory;
  message: string;
  status?: number;
  userId?: string;
  requestId?: string | null;
  provider?: string;
  severity?: "warning" | "critical";
  context?: Record<string, unknown>;
};

export function getErrorMessage(error: unknown, fallback = "Unexpected error") {
  return error instanceof Error ? error.message : fallback;
}

export async function logCentralizedError(error: unknown, details: LoggedError) {
  const message = details.message || getErrorMessage(error);
  const context = {
    category: details.category,
    status: details.status,
    userId: details.userId,
    requestId: details.requestId,
    provider: details.provider,
    ...details.context
  };

  logger.error(message, context);
  Sentry.captureException(error instanceof Error ? error : new Error(message), {
    tags: {
      category: details.category,
      provider: details.provider ?? details.category,
      severity: details.severity ?? "warning"
    },
    extra: context
  });

  if (details.severity === "critical") {
    await sendCriticalAlert({
      title: `${details.category.toUpperCase()} failure`,
      message,
      severity: "critical",
      context
    });
  }
}
