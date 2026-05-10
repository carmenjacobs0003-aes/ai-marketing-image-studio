import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createProject, listBrandKits } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  brandKitId: z.string().uuid().optional().nullable()
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid project details.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient();
  const { brandKitId } = parsed.data;

  if (brandKitId) {
    const brandKits = await listBrandKits(supabase, user.id);

    if (!brandKits.some((brandKit) => brandKit.id === brandKitId)) {
      return NextResponse.json(
        { error: "Select a brand kit you own." },
        { status: 400 }
      );
    }
  }

  const project = await createProject(supabase, {
    user_id: user.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    brand_kit_id: brandKitId ?? null
  });

  return NextResponse.json({ project }, { status: 201 });
}
