import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import {
  getGenerationRecoveryCutoffMinutes,
  recoverStaleGenerations
} from "@/lib/recovery/generations";

export const runtime = "nodejs";

function getRecoverySecret() {
  return process.env.RECOVERY_SECRET ?? process.env.CRON_SECRET;
}

function isAuthorized(request: NextRequest) {
  const secret = getRecoverySecret();
  const authorization = request.headers.get("authorization");

  return Boolean(secret && authorization === `Bearer ${secret}`);
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
