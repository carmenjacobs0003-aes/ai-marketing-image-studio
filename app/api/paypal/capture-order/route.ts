import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "One-time PayPal captures are disabled. Subscription activation is handled by PayPal webhooks."
    },
    { status: 410 }
  );
}
