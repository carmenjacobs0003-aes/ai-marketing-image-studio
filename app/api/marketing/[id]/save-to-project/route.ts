import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { listProjects, updateMarketingGeneration } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({ projectId: z.string().uuid().nullable() });
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
      { error: "Select a valid project.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient();

  if (parsed.data.projectId) {
    const projects = await listProjects(supabase, user.id);

    if (!projects.some((project) => project.id === parsed.data.projectId)) {
      return NextResponse.json(
        { error: "Select a project you own before saving this content." },
        { status: 400 }
      );
    }
  }

  const generation = await updateMarketingGeneration(
    supabase,
    params.id,
    user.id,
    {
      project_id: parsed.data.projectId
    }
  ).catch(() => null);

  if (!generation) {
    return NextResponse.json(
      { error: "Unable to save marketing content to project." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: generation.id,
    projectId: generation.project_id
  });
}
