import { getRedisDiagnostics, redis } from "@/lib/redis/client";
import { logger } from "@/lib/logger";

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  degraded?: boolean;
};

const memoryStore = new Map<string, { count: number; reset: number }>();

function sanitizeRateLimitKey(key: string) {
  return key.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "[id]");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unknown Redis rate limit failure";
}

function isRedisAuthError(error: unknown) {
  return /wrongpass|invalid or missing auth token|unauthorized|forbidden|authentication/i.test(
    getErrorMessage(error)
  );
}

function applyMemoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const reset = now + windowSeconds * 1000;
  const current = memoryStore.get(key);

  if (!current || current.reset <= now) {
    memoryStore.set(key, { count: 1, reset });
    return { success: true, limit, remaining: limit - 1, reset };
  }

  current.count += 1;
  memoryStore.set(key, current);

  return {
    success: current.count <= limit,
    limit,
    remaining: Math.max(limit - current.count, 0),
    reset: current.reset
  };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (redis) {
    const redisKey = `rate-limit:${key}`;
    const sanitizedKey = sanitizeRateLimitKey(key);

    logger.info("Redis rate limit check start", {
      key: sanitizedKey,
      limit,
      windowSeconds,
      redis: getRedisDiagnostics()
    });

    try {
      const count = await redis.incr(redisKey);

      if (count === 1) {
        await redis.expire(redisKey, windowSeconds);
      }

      const ttl = await redis.ttl(redisKey);
      const redisReset = Date.now() + Math.max(ttl, 0) * 1000;
      const result = {
        success: count <= limit,
        limit,
        remaining: Math.max(limit - count, 0),
        reset: redisReset
      };

      logger.info("Redis rate limit check completed", {
        key: sanitizedKey,
        count,
        ttl,
        blocked: !result.success,
        result
      });

      return result;
    } catch (error) {
      const authFailure = isRedisAuthError(error);

      logger.error(
        authFailure
          ? "Upstash Redis authentication failed during rate limit check"
          : "Upstash Redis rate limit check failed",
        {
          key: sanitizedKey,
          authFailure,
          error: getErrorMessage(error)
        }
      );

      const fallbackResult = applyMemoryRateLimit(key, limit, windowSeconds);

      logger.warn("Using in-memory rate limit fallback after Redis failure", {
        key: sanitizedKey,
        authFailure,
        success: fallbackResult.success,
        reset: fallbackResult.reset
      });

      return { ...fallbackResult, degraded: true };
    }
  }

  const result = applyMemoryRateLimit(key, limit, windowSeconds);

  logger.warn("Using in-memory rate limit because Redis is not configured", {
    key: sanitizeRateLimitKey(key),
    limit,
    windowSeconds,
    blocked: !result.success,
    result
  });

  return result;
}
