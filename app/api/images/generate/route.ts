import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createMarketingImage } from "@/lib/openai/images";
import { rateLimit } from "@/lib/rate-limit";
import {
  uploadGeneratedImage,
  createSignedImageUrl
} from "@/lib/storage/images";
import {
  assertCanGenerateImage,
  recordSuccessfulUsage
} from "@/lib/usage/limits";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createImageGeneration, updateImageGeneration } from "@/lib/db/queries";

const requestSchema = z.object({
  prompt: z.string().min(10).max(2000),
  projectId: z.string().uuid().optional(),
  brandKitId: z.string().uuid().optional()
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const json = await request.json();
  const parsed = requestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid image generation request",
        issues: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const limiter = await rateLimit(
    `images:${user.id}`,
    env.IMAGE_GENERATION_RATE_LIMIT,
    env.IMAGE_GENERATION_RATE_LIMIT_WINDOW_SECONDS
  );

  if (!limiter.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded", reset: limiter.reset },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limiter.limit),
          "X-RateLimit-Remaining": String(limiter.remaining),
          "X-RateLimit-Reset": String(limiter.reset)
        }
      }
    );
  }

  const entitlement = await assertCanGenerateImage(user.id);

  if (!entitlement.allowed) {
    return NextResponse.json(
      { error: entitlement.reason, usage: entitlement.usage },
      { status: 402 }
    );
  }

  const supabase = createSupabaseServerClient();
  const generation = await createImageGeneration(supabase, {
    user_id: user.id,
    project_id: payload.projectId ?? null,
    brand_kit_id: payload.brandKitId ?? null,
    prompt: payload.prompt,
    model: env.OPENAI_IMAGE_MODEL,
    status: "processing"
  }).catch(() => null);

  if (!generation) {
    return NextResponse.json(
      { error: "Unable to create image generation" },
      { status: 500 }
    );
  }

  try {
    const image = await createMarketingImage(payload.prompt);
    const base64Image = image.data?.[0]?.b64_json;

    if (!base64Image) {
      throw new Error("OpenAI did not return an image payload.");
    }

    const storagePath = await uploadGeneratedImage(
      user.id,
      generation.id,
      base64Image
    );
    await updateImageGeneration(supabase, generation.id, user.id, {
      status: "completed",
      storage_path: storagePath,
      metadata: { openai_created: image.created ?? null }
    });
    await recordSuccessfulUsage(user.id, "image_generations");
    const signedUrl = await createSignedImageUrl(storagePath);

    return NextResponse.json(
      { id: generation.id, storagePath, signedUrl },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Image generation failed";
    await updateImageGeneration(supabase, generation.id, user.id, {
      status: "failed",
      error_message: message
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
