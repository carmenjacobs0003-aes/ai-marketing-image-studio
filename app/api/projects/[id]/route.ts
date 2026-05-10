import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteProject, listBrandKits, updateProject } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  brandKitId: z.string().uuid().optional().nullable(),
  status: z.enum(["active", "archived"]).optional()
});

type RouteContext = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid project update.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient();

  if (parsed.data.brandKitId) {
    const brandKits = await listBrandKits(supabase, user.id);

    if (!brandKits.some((brandKit) => brandKit.id === parsed.data.brandKitId)) {
      return NextResponse.json(
        { error: "Select a brand kit you own." },
        { status: 400 }
      );
    }
  }

  const project = await updateProject(supabase, params.id, user.id, {
    ...(parsed.data.name ? { name: parsed.data.name } : {}),
    ...(parsed.data.description !== undefined
      ? { description: parsed.data.description || null }
      : {}),
    ...(parsed.data.brandKitId !== undefined
      ? { brand_kit_id: parsed.data.brandKitId }
      : {}),
    ...(parsed.data.status ? { status: parsed.data.status } : {})
  }).catch(() => null);

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json({ project });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteProject(createSupabaseServerClient(), params.id, user.id);

  return NextResponse.json({ id: params.id });
}
