import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TypedSupabaseClient } from "@/lib/db/helpers";
import { createGalleryItem, normalizeTags } from "@/lib/gallery/db";

const publishSchema = z.object({
  sourceId: z.string().uuid(),
  kind: z.enum(["image", "marketing"]),
  visibility: z.enum(["public", "private"]).default("public"),
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(600).optional().nullable(),
  category: z.string().trim().min(2).max(80).default("Campaign"),
  tags: z.array(z.string().trim().min(1).max(32)).max(8).default([]),
  reusablePrompt: z.string().trim().min(10).max(4000).optional()
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = publishSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid gallery publish request", issues: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createSupabaseServerClient() as unknown as TypedSupabaseClient;
  const payload = parsed.data;

  if (payload.kind === "image") {
    const { data: image, error } = await supabase
      .from("image_generations")
      .select("*")
      .eq("id", payload.sourceId)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .maybeSingle();

    if (error || !image?.storage_path) {
      return NextResponse.json({ error: "Choose a completed image you own before publishing." }, { status: 404 });
    }

    const item = await createGalleryItem(supabase, {
      creator_id: user.id,
      source_image_generation_id: image.id,
      kind: "image",
      visibility: payload.visibility,
      title: payload.title,
      description: payload.description ?? null,
      prompt: image.prompt,
      reusable_prompt: payload.reusablePrompt ?? image.prompt,
      category: payload.category,
      tags: normalizeTags(payload.tags),
      image_storage_path: image.storage_path,
      metadata: { source_metadata: image.metadata },
      published_at: payload.visibility === "public" ? new Date().toISOString() : null
    });

    return NextResponse.json({ item }, { status: 201 });
  }

  const { data: generation, error } = await supabase
    .from("marketing_generations")
    .select("*")
    .eq("id", payload.sourceId)
    .eq("user_id", user.id)
    .eq("status", "completed")
    .maybeSingle();

  if (error || !generation) {
    return NextResponse.json({ error: "Choose completed marketing content you own before publishing." }, { status: 404 });
  }

  const item = await createGalleryItem(supabase, {
    creator_id: user.id,
    source_marketing_generation_id: generation.id,
    kind: "marketing",
    visibility: payload.visibility,
    title: payload.title,
    description: payload.description ?? null,
    prompt: generation.prompt,
    reusable_prompt: payload.reusablePrompt ?? generation.prompt,
    category: payload.category,
    tags: normalizeTags(payload.tags),
    marketing_output: generation.output,
    metadata: { content_type: generation.content_type, source_metadata: generation.metadata },
    published_at: payload.visibility === "public" ? new Date().toISOString() : null
  });

  return NextResponse.json({ item }, { status: 201 });
}
