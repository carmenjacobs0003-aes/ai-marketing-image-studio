import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_STALE_IMAGE_GENERATION_TIMEOUT_MS,
  recoverStaleImageGenerations
} from "@/lib/db/queries";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getRecoveryTimeoutMs() {
  return Math.max(
    DEFAULT_STALE_IMAGE_GENERATION_TIMEOUT_MS,
    env.API_TIMEOUT_SECONDS * 2 * 1000
  );
}

function isAuthorizedRecoveryRequest(request: NextRequest) {
  if (env.CRON_SECRET) {
    return request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
  }

  return (
    request.headers.get("x-vercel-cron") === "1" ||
    request.headers.get("user-agent")?.toLowerCase().includes("vercel-cron") ||
    process.env.NODE_ENV !== "production"
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedRecoveryRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const supabase = createSupabaseAdminClient();
  const result = await recoverStaleImageGenerations(supabase, {
    staleAfterMs: getRecoveryTimeoutMs()
  });

  logger.warn("Stale image generation recovery completed", {
    recovered: result.recovered,
    cutoff: result.cutoff,
    durationMs: Date.now() - startedAt
  });

  return NextResponse.json(
    {
      ok: true,
      recovered: result.recovered,
      cutoff: result.cutoff
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
