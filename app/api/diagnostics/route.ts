import { NextResponse } from "next/server";
import { runConnectivityDiagnostics } from "@/lib/monitoring/diagnostics";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();

  logger.info("Diagnostics endpoint request received", {
    path: "/api/diagnostics"
  });

  try {
    const diagnostics = await runConnectivityDiagnostics();
    const status = diagnostics.status === "fail" ? 503 : 200;

    logger.info("Diagnostics endpoint response", {
      status,
      diagnosticStatus: diagnostics.status,
      failed: diagnostics.failed,
      warnings: diagnostics.warnings,
      passed: diagnostics.passed,
      durationMs: Date.now() - startedAt
    });

    return NextResponse.json(diagnostics, {
      status,
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown diagnostics failure";

    logger.error("Diagnostics endpoint failed", {
      error: message,
      durationMs: Date.now() - startedAt
    });

    return NextResponse.json(
      {
        status: "fail",
        failed: 1,
        warnings: 0,
        passed: 0,
        checks: [
          {
            name: "Diagnostics endpoint",
            status: "fail",
            detail: message,
            recovery: "Review server logs for the failing diagnostics probe."
          }
        ]
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store, max-age=0" }
      }
    );
  }
}
