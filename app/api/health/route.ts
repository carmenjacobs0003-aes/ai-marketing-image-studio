import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "ai-marketing-image-studio",
    environment:
      process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    region: process.env.VERCEL_REGION ?? "local",
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    timestamp: new Date().toISOString(),
    diagnostics: {
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      redis: Boolean(process.env.UPSTASH_REDIS_REST_URL),
      sentry: Boolean(
        process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
      ),
      openai: Boolean(process.env.OPENAI_API_KEY)
    }
  });
}
