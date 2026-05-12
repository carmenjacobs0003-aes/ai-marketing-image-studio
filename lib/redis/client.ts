import { Redis } from "@upstash/redis";
import { env, getRedisEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

const redisEnv = getRedisEnv(env);

export function getRedisDiagnostics() {
  return {
    configured: redisEnv.configured,
    source: redisEnv.source,
    hasUrl: Boolean(redisEnv.url),
    hasToken: Boolean(redisEnv.token),
    missing: redisEnv.missing
  };
}

if (!redisEnv.configured) {
  logger.warn("Upstash Redis environment variables are missing", {
    missing: redisEnv.missing,
    upstashRedisRestUrlConfigured: Boolean(env.UPSTASH_REDIS_REST_URL),
    upstashRedisRestAuthConfigured: Boolean(env.UPSTASH_REDIS_REST_TOKEN),
    vercelKvRestApiUrlConfigured: Boolean(env.KV_REST_API_URL),
    vercelKvRestApiAuthConfigured: Boolean(env.KV_REST_API_TOKEN)
  });
} else if (redisEnv.source === "vercel-kv-alias") {
  logger.info("Using Vercel KV REST environment aliases for Upstash Redis", {
    source: redisEnv.source,
    hasRedisUrl: true,
    hasRedisToken: true
  });
} else {
  logger.info("Upstash Redis REST environment detected", {
    source: redisEnv.source,
    hasRedisUrl: true,
    hasRedisToken: true
  });
}

export const redis = redisEnv.configured
  ? new Redis({
      url: redisEnv.url!,
      token: redisEnv.token!
    })
  : null;

export async function verifyRedisConnection(
  context: Record<string, unknown> = {}
) {
  const diagnostics = getRedisDiagnostics();

  logger.info("Upstash Redis connection verification start", {
    ...context,
    redis: diagnostics
  });

  if (!redis) {
    logger.warn("Upstash Redis connection verification skipped", {
      ...context,
      redis: diagnostics,
      reason: "redis_not_configured"
    });

    return {
      ok: false,
      reason: "redis_not_configured",
      diagnostics
    } as const;
  }

  const startedAt = Date.now();

  try {
    const pong = await redis.ping();

    logger.info("Upstash Redis connection verification completed", {
      ...context,
      redis: diagnostics,
      durationMs: Date.now() - startedAt,
      response: pong
    });

    return {
      ok: true,
      response: pong,
      diagnostics
    } as const;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Redis ping failure";

    logger.error("Upstash Redis connection verification failed", {
      ...context,
      redis: diagnostics,
      durationMs: Date.now() - startedAt,
      error: message
    });

    return {
      ok: false,
      reason: "redis_connection_failed",
      error: message,
      diagnostics
    } as const;
  }
}
