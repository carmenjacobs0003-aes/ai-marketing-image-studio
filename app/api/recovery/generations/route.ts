import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import {
  getGenerationRecoveryCutoffMinutes,
  recoverStaleGenerations
} from "@/lib/recovery/generations";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  if (!cronSecret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

async function runRecovery(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const cutoffMinutes = getGenerationRecoveryCutoffMinutes();
  const supabase = createSupabaseAdminClient();
  const results = await recoverStaleGenerations(supabase, { cutoffMinutes });

  logger.info("Stale generation recovery endpoint completed", {
    durationMs: Date.now() - startedAt,
    cutoffMinutes,
    results
  });

  return NextResponse.json({ success: true, cutoffMinutes, results });
}

export async function GET(request: NextRequest) {
  return runRecovery(request);
}

export async function POST(request: NextRequest) {
  return runRecovery(request);
}
