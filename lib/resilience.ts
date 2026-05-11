import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatuses?: number[];
  label?: string;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
};

export class ProviderError extends Error {
  readonly provider: string;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    provider: string,
    message: string,
    options: { status?: number; retryable?: boolean } = {}
  ) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.status = options.status;
    this.retryable = options.retryable ?? true;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStatus(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }

  return undefined;
}

export function isRetryableError(
  error: unknown,
  retryableStatuses = [408, 409, 425, 429, 500, 502, 503, 504]
) {
  if (error instanceof ProviderError) {
    return error.retryable;
  }

  const status = getStatus(error);
  if (status) {
    return retryableStatuses.includes(status);
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return /timeout|temporarily|network|fetch failed|socket|econnreset|rate limit/.test(
    message
  );
}

export function normalizeFailureMessage(provider: string, error: unknown) {
  if (error instanceof ProviderError) {
    return error.message;
  }

  const status = getStatus(error);
  const rawMessage = error instanceof Error ? error.message : String(error);

  if (/api key|authorization|unauthorized|forbidden/i.test(rawMessage)) {
    return `${provider} is not fully configured. Please contact support.`;
  }

  if (/timeout|timed out/i.test(rawMessage)) {
    return `${provider} timed out before completing the request. Your work is safe; please retry in a moment.`;
  }

  if (status === 429 || /rate limit/i.test(rawMessage)) {
    return `${provider} is receiving too many requests. Please wait briefly and retry.`;
  }

  if (status && status >= 500) {
    return `${provider} is temporarily unavailable. Please retry in a moment.`;
  }

  return rawMessage || `${provider} request failed.`;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = options.attempts ?? env.PROVIDER_RETRY_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? env.PROVIDER_RETRY_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? env.PROVIDER_RETRY_MAX_DELAY_MS;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt >= attempts || !isRetryableError(error, options.retryableStatuses)) {
        throw error;
      }

      const exponentialDelay = Math.min(
        maxDelayMs,
        baseDelayMs * 2 ** (attempt - 1)
      );
      const jitter = Math.round(exponentialDelay * Math.random() * 0.25);
      const delayMs = exponentialDelay + jitter;

      options.onRetry?.(error, attempt, delayMs);
      logger.warn("Retrying failed operation", {
        label: options.label,
        attempt,
        delayMs,
        error: error instanceof Error ? error.message : String(error)
      });
      await sleep(delayMs);
    }
  }

  throw lastError;
}
