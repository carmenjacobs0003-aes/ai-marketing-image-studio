import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createImageGeneration, createMarketingGeneration, listProjects } from "@/lib/db/queries";
import { getPublicGalleryItem, incrementGalleryMetric } from "@/lib/gallery/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TypedSupabaseClient } from "@/lib/db/helpers";

const schema = z.object({ projectId: z.string().uuid().nullable().optional() });
type RouteContext = { params: { id: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save gallery content." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Select a valid project.", issues: parsed.error.flatten() }, { status: 400 });

  const supabase = createSupabaseServerClient() as unknown as TypedSupabaseClient;
  const item = await getPublicGalleryItem(supabase, params.id);
  if (!item) return NextResponse.json({ error: "Gallery item not found." }, { status: 404 });

  const projectId = parsed.data.projectId ?? null;
  if (projectId) {
    const projects = await listProjects(supabase, user.id);
    if (!projects.some((project) => project.id === projectId)) {
      return NextResponse.json({ error: "Select a project you own." }, { status: 400 });
    }
  }

  if (item.kind === "image") {
    const generation = await createImageGeneration(supabase, {
      user_id: user.id,
      project_id: projectId,
      prompt: item.reusable_prompt,
      model: "community-remix",
      status: "completed",
      storage_path: item.image_storage_path,
      metadata: { copied_from_gallery_item_id: item.id, creator_id: item.creator_id }
    });
    await incrementGalleryMetric(supabase, item.id, "copy").catch(() => null);
    return NextResponse.json({ id: generation.id, kind: "image" }, { status: 201 });
  }

  const generation = await createMarketingGeneration(supabase, {
    user_id: user.id,
    project_id: projectId,
    prompt: item.reusable_prompt,
    content_type: typeof item.metadata === "object" && item.metadata && !Array.isArray(item.metadata) && typeof item.metadata.content_type === "string" ? item.metadata.content_type : "complete_marketing_pack",
    model: "community-remix",
    status: "completed",
    output: item.marketing_output,
    metadata: { copied_from_gallery_item_id: item.id, creator_id: item.creator_id }
  });
  await incrementGalleryMetric(supabase, item.id, "copy").catch(() => null);
  return NextResponse.json({ id: generation.id, kind: "marketing" }, { status: 201 });
}
