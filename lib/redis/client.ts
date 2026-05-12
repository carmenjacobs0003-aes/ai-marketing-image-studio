import { Redis } from "@upstash/redis";
import { env, getRedisEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

const redisEnv = getRedisEnv(env);

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
}

export const redis = redisEnv.configured
  ? new Redis({
      url: redisEnv.url!,
      token: redisEnv.token!
    })
  : null;
