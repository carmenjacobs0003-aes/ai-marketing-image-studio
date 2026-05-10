import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ message: "Image generation placeholder" }, { status: 202 });
}
