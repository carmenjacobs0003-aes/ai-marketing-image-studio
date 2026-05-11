import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { reportGalleryItem } from "@/lib/gallery/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TypedSupabaseClient } from "@/lib/db/helpers";

const schema = z.object({ reason: z.string().trim().min(3).max(80), details: z.string().trim().max(1000).optional() });
type RouteContext = { params: { id: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to report gallery items." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid report", issues: parsed.error.flatten() }, { status: 400 });
  const report = await reportGalleryItem(createSupabaseServerClient() as unknown as TypedSupabaseClient, { itemId: params.id, reporterId: user.id, reason: parsed.data.reason, details: parsed.data.details }).catch(() => null);
  if (!report) return NextResponse.json({ error: "Unable to submit report." }, { status: 400 });
  return NextResponse.json({ report }, { status: 201 });
}
