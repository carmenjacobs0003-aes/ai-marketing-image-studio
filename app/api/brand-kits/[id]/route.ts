import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  clearDefaultBrandKits,
  deleteBrandKit,
  updateBrandKit
} from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const listSchema = z.string().trim().min(1).max(80).array().max(12).optional();
const requestSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  colors: listSchema,
  fonts: listSchema,
  tone: z.string().trim().max(400).optional().nullable(),
  voice: z.string().trim().max(1000).optional().nullable(),
  logoUrl: z.string().trim().url().max(1000).optional().nullable(),
  guidelines: z.string().trim().max(2000).optional().nullable(),
  isDefault: z.boolean().optional()
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
      { error: "Invalid brand kit update.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient();

  if (parsed.data.isDefault) {
    await clearDefaultBrandKits(supabase, user.id, params.id);
  }

  const brandKit = await updateBrandKit(supabase, params.id, user.id, {
    ...(parsed.data.name ? { name: parsed.data.name } : {}),
    ...(parsed.data.colors ? { colors: parsed.data.colors } : {}),
    ...(parsed.data.fonts ? { fonts: parsed.data.fonts } : {}),
    ...(parsed.data.tone !== undefined
      ? { tone: parsed.data.tone || null }
      : {}),
    ...(parsed.data.voice !== undefined
      ? { voice: parsed.data.voice || null }
      : {}),
    ...(parsed.data.logoUrl !== undefined
      ? { logo_url: parsed.data.logoUrl || null }
      : {}),
    ...(parsed.data.guidelines !== undefined
      ? { guidelines: parsed.data.guidelines || null }
      : {}),
    ...(parsed.data.isDefault !== undefined
      ? { is_default: parsed.data.isDefault }
      : {})
  }).catch(() => null);

  if (!brandKit) {
    return NextResponse.json(
      { error: "Brand kit not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ brandKit });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteBrandKit(createSupabaseServerClient(), params.id, user.id);

  return NextResponse.json({ id: params.id });
}
