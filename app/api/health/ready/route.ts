import { NextResponse } from "next/server";
import { env, validateProductionEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const validation = validateProductionEnv(env);
  const paypalReady =
    env.PAYPAL_ENV !== "live" ||
    Boolean(
      env.PAYPAL_CLIENT_ID &&
      env.PAYPAL_CLIENT_SECRET &&
      env.NEXT_PUBLIC_PAYPAL_CLIENT_ID &&
      env.PAYPAL_WEBHOOK_ID &&
      env.PAYPAL_PRO_PLAN_ID &&
      env.PAYPAL_AGENCY_PLAN_ID
    );
  const ready = validation.valid && paypalReady;

  return NextResponse.json(
    {
      status: ready ? "ready" : "not_ready",
      service: "ai-marketing-image-studio",
      timestamp: new Date().toISOString(),
      checks: {
        environment: validation.valid,
        supabase: Boolean(
          env.NEXT_PUBLIC_SUPABASE_URL &&
          env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
          env.SUPABASE_SERVICE_ROLE_KEY
        ),
        redis: Boolean(
          env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
        ),
        openai: Boolean(env.OPENAI_API_KEY),
        sentry: false,
        paypal: paypalReady
      },
      missing: validation.missing
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}

export function HEAD() {
  const validation = validateProductionEnv(env);
  return new Response(null, {
    status: validation.valid ? 204 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0"
    }
  });
}
