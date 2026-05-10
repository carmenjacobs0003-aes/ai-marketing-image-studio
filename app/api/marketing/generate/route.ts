import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createMarketingGeneration,
  getDailyUsage,
  listBrandKits,
  updateMarketingGeneration
} from "@/lib/db/queries";
import {
  createMarketingCopy,
  getMarketingModelName
} from "@/lib/openai/marketing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  assertCanGenerateMarketing,
  recordSuccessfulUsage
} from "@/lib/usage/limits";

const requestSchema = z.object({
  prompt: z.string().min(10).max(4000),
  contentType: z.string().min(2).max(80).default("campaign"),
  projectId: z.string().uuid().optional(),
  brandKitId: z.string().uuid().optional()
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid marketing generation request",
        issues: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const entitlement = await assertCanGenerateMarketing(user.id);

  if (!entitlement.allowed) {
    return NextResponse.json(
      { error: entitlement.reason, usage: entitlement.usage },
      { status: 402 }
    );
  }

  const payload = parsed.data;
  const supabase = createSupabaseServerClient();

  let brandContext: { voice: string | null; guidelines: string | null } | null =
    null;

  if (payload.brandKitId) {
    const brandKits = await listBrandKits(supabase, user.id);
    const brandKit = brandKits.find((item) => item.id === payload.brandKitId);

    if (!brandKit) {
      return NextResponse.json(
        { error: "Brand kit not found" },
        { status: 404 }
      );
    }

    brandContext = { voice: brandKit.voice, guidelines: brandKit.guidelines };
  }

  const generation = await createMarketingGeneration(supabase, {
    user_id: user.id,
    project_id: payload.projectId ?? null,
    brand_kit_id: payload.brandKitId ?? null,
    prompt: payload.prompt,
    content_type: payload.contentType,
    model: getMarketingModelName(),
    status: "processing"
  }).catch(() => null);

  if (!generation) {
    return NextResponse.json(
      { error: "Unable to create marketing generation" },
      { status: 500 }
    );
  }

  try {
    const copy = await createMarketingCopy({
      prompt: payload.prompt,
      contentType: payload.contentType,
      brandVoice: brandContext?.voice,
      guidelines: brandContext?.guidelines
    });

    if (!copy.text) {
      throw new Error("OpenAI did not return marketing copy.");
    }

    const completed = await updateMarketingGeneration(
      supabase,
      generation.id,
      user.id,
      {
        status: "completed",
        output: { text: copy.text },
        metadata: { openai_id: copy.raw.id, model: copy.model }
      }
    );
    await recordSuccessfulUsage(user.id, "marketing_generations");
    const usage = await getDailyUsage(supabase, user.id);

    return NextResponse.json({ generation: completed, usage }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Marketing generation failed";
    await updateMarketingGeneration(supabase, generation.id, user.id, {
      status: "failed",
      error_message: message
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
