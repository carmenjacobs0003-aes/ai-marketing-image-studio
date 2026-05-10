import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "One-time PayPal orders are disabled. Use /api/paypal/subscriptions for subscription checkout."
    },
    { status: 410 }
  );
}
