import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { toggleGalleryFavorite } from "@/lib/gallery/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TypedSupabaseClient } from "@/lib/db/helpers";

type RouteContext = { params: { id: string } };

export async function POST(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to favorite gallery items." }, { status: 401 });
  const result = await toggleGalleryFavorite(createSupabaseServerClient() as unknown as TypedSupabaseClient, user.id, params.id).catch(() => null);
  if (!result) return NextResponse.json({ error: "Unable to update favorite." }, { status: 400 });
  return NextResponse.json(result);
}
