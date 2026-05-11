import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const API_RATE_LIMIT = 120;
const API_RATE_LIMIT_WINDOW_SECONDS = 60;
const memoryStore = new Map<string, { count: number; reset: number }>();

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function applyEdgeRateLimit(key: string) {
  const now = Date.now();
  const current = memoryStore.get(key);

  if (!current || current.reset <= now) {
    const reset = now + API_RATE_LIMIT_WINDOW_SECONDS * 1000;
    memoryStore.set(key, { count: 1, reset });
    return {
      success: true,
      limit: API_RATE_LIMIT,
      remaining: API_RATE_LIMIT - 1,
      reset
    };
  }

  current.count += 1;
  memoryStore.set(key, current);

  return {
    success: current.count <= API_RATE_LIMIT,
    limit: API_RATE_LIMIT,
    remaining: Math.max(API_RATE_LIMIT - current.count, 0),
    reset: current.reset
  };
}

export async function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    request.method !== "GET"
  ) {
    const limiter = applyEdgeRateLimit(
      `api:${getClientIp(request)}:${request.nextUrl.pathname}`
    );

    if (!limiter.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait and try again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((limiter.reset - Date.now()) / 1000)
            ),
            "X-RateLimit-Limit": String(limiter.limit),
            "X-RateLimit-Remaining": String(limiter.remaining),
            "X-RateLimit-Reset": String(limiter.reset)
          }
        }
      );
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
  ]
};
