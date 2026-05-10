import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ message: "PayPal capture order placeholder" }, { status: 202 });
}
