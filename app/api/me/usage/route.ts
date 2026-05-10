import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getUsageSummary } from "@/lib/usage/limits";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const usage = await getUsageSummary(user.id);

  return NextResponse.json(usage);
}
