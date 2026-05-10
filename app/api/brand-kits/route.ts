import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { clearDefaultBrandKits, createBrandKit } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const listSchema = z.string().trim().min(1).max(80).array().max(12).default([]);
const requestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  colors: listSchema,
  fonts: listSchema,
  tone: z.string().trim().max(400).optional().nullable(),
  voice: z.string().trim().max(1000).optional().nullable(),
  logoUrl: z.string().trim().url().max(1000).optional().nullable(),
  guidelines: z.string().trim().max(2000).optional().nullable(),
  isDefault: z.boolean().default(false)
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
      { error: "Invalid brand kit.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient();

  if (parsed.data.isDefault) {
    await clearDefaultBrandKits(supabase, user.id);
  }

  const brandKit = await createBrandKit(supabase, {
    user_id: user.id,
    name: parsed.data.name,
    colors: parsed.data.colors,
    fonts: parsed.data.fonts,
    tone: parsed.data.tone || null,
    voice: parsed.data.voice || null,
    logo_url: parsed.data.logoUrl || null,
    guidelines: parsed.data.guidelines || null,
    is_default: parsed.data.isDefault
  });

  return NextResponse.json({ brandKit }, { status: 201 });
}
