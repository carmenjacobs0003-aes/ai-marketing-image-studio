import { redis } from "@/lib/redis/client";

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

const memoryStore = new Map<string, { count: number; reset: number }>();

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const now = Date.now();
  const reset = now + windowSeconds * 1000;

  if (redis) {
    const redisKey = `rate-limit:${key}`;
    const count = await redis.incr(redisKey);

    if (count === 1) {
      await redis.expire(redisKey, windowSeconds);
    }

    const ttl = await redis.ttl(redisKey);
    const redisReset = now + Math.max(ttl, 0) * 1000;

    return {
      success: count <= limit,
      limit,
      remaining: Math.max(limit - count, 0),
      reset: redisReset
    };
  }

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
