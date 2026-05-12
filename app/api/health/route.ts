import { NextResponse } from "next/server";
import { env, validateProductionEnv } from "@/lib/env";
import { summarizeDiagnostics } from "@/lib/monitoring/diagnostics";

export const dynamic = "force-dynamic";

function healthPayload() {
  const productionEnv = validateProductionEnv(env);

  return {
    status: "ok",
    service: "syntrix-ai",
    environment:
      process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    region: process.env.VERCEL_REGION ?? "local",
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    timestamp: new Date().toISOString(),
    deployment: {
      vercel: process.env.VERCEL === "1",
      url: process.env.VERCEL_URL ?? env.NEXT_PUBLIC_SITE_DOMAIN ?? "local",
      productionEnvValid: productionEnv.valid,
      missingProductionEnv: productionEnv.missing
    },
    diagnostics: {
      summary: summarizeDiagnostics(),
      supabase: Boolean(
        env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ),
      supabaseAdmin: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      redis: Boolean(
        env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
      ),
      sentry: false,
      openai: Boolean(env.OPENAI_API_KEY),
      paypal: Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET),
      paypalLiveReady:
        env.PAYPAL_ENV === "live"
          ? Boolean(
              env.NEXT_PUBLIC_PAYPAL_CLIENT_ID &&
              env.PAYPAL_WEBHOOK_ID &&
              env.PAYPAL_PRO_PLAN_ID &&
              env.PAYPAL_AGENCY_PLAN_ID
            )
          : true
    }
  };
}

export function GET() {
  return NextResponse.json(healthPayload(), {
    headers: {
      "Cache-Control": "no-store, max-age=0"
    }
  });
}

export function HEAD() {
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store, max-age=0"
    }
  });
}
