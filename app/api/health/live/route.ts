import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "live",
      service: "ai-marketing-image-studio",
      timestamp: new Date().toISOString()
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export function HEAD() {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}
