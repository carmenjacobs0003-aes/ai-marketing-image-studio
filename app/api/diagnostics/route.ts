import { NextResponse } from "next/server";
import { summarizeDiagnostics } from "@/lib/monitoring/diagnostics";

export const dynamic = "force-dynamic";

export function GET() {
  const diagnostics = summarizeDiagnostics();

  return NextResponse.json(diagnostics, {
    status: diagnostics.status === "fail" ? 503 : 200,
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}
