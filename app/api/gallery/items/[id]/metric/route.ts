import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { incrementGalleryMetric } from "@/lib/gallery/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TypedSupabaseClient } from "@/lib/db/helpers";

const schema = z.object({ metric: z.enum(["view", "copy", "remix"]) });
type RouteContext = { params: { id: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
  const item = await incrementGalleryMetric(createSupabaseServerClient() as unknown as TypedSupabaseClient, params.id, parsed.data.metric).catch(() => null);
  if (!item) return NextResponse.json({ error: "Gallery item not found" }, { status: 404 });
  return NextResponse.json({ item });
}
