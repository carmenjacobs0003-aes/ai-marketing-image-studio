import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { injectBrandIntoImagePrompt } from "@/lib/brand/prompt";
import {
  createMarketingImage,
  getGeneratedImageBase64,
  moderateImagePrompt
} from "@/lib/openai/images";
import { rateLimit } from "@/lib/rate-limit";
import {
  uploadGeneratedImage,
  createSignedImageUrl,
  createSignedDownloadUrl
} from "@/lib/storage/images";
import {
  assertCanGenerateImage,
  recordSuccessfulUsage
} from "@/lib/usage/limits";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createImageGeneration,
  listBrandKits,
  listProjects,
  updateImageGeneration
} from "@/lib/db/queries";

const requestSchema = z.object({
  prompt: z.string().trim().min(10).max(2000),
  projectId: z.string().uuid().optional(),
  brandKitId: z.string().uuid().optional(),
  size: z.enum(["1024x1024", "1024x1792", "1792x1024"]).default("1024x1024"),
  quality: z.enum(["standard", "hd"]).default("standard")
});

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
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
  const [projects, brandKits] = await Promise.all([
    listProjects(supabase, user.id),
    listBrandKits(supabase, user.id)
  ]);

  const project = payload.projectId
    ? projects.find((item) => item.id === payload.projectId)
    : null;

  if (payload.projectId && !project) {
    return NextResponse.json(
      { error: "Select a valid project before saving this image." },
      { status: 400 }
    );
  }

  const selectedBrandKitId =
    payload.brandKitId ??
    project?.brand_kit_id ??
    brandKits.find((item) => item.is_default)?.id;
  const brandKit = selectedBrandKitId
    ? brandKits.find((item) => item.id === selectedBrandKitId)
    : null;

  if (selectedBrandKitId && !brandKit) {
    return NextResponse.json(
      { error: "Select a valid brand kit before generating this image." },
      { status: 400 }
    );
  }

  const moderation = await moderateImagePrompt(payload.prompt);
  const moderationMetadata = JSON.parse(JSON.stringify(moderation));

  if (moderation.flagged) {
    return NextResponse.json(
      {
        error:
          "This prompt was blocked by safety moderation. Please revise it and try again."
      },
      { status: 400 }
    );
  }

  const generation = await createImageGeneration(supabase, {
    user_id: user.id,
    project_id: payload.projectId ?? null,
    brand_kit_id: brandKit?.id ?? null,
    prompt: payload.prompt,
    model: env.OPENAI_IMAGE_MODEL,
    status: "processing",
    metadata: {
      moderation: moderationMetadata,
      size: payload.size,
      quality: payload.quality
    }
  }).catch(() => null);

  if (!generation) {
    return NextResponse.json(
      { error: "Unable to create image generation" },
      { status: 500 }
    );
  }

  try {
    const brandedPrompt = injectBrandIntoImagePrompt(payload.prompt, brandKit);
    const image = await createMarketingImage({
      prompt: brandedPrompt,
      size: payload.size,
      quality: payload.quality
    });
    const base64Image = getGeneratedImageBase64(image);
    const storagePath = await uploadGeneratedImage(
      user.id,
      generation.id,
      base64Image
    );
    await updateImageGeneration(supabase, generation.id, user.id, {
      status: "completed",
      storage_path: storagePath,
      metadata: {
        moderation: moderationMetadata,
        size: payload.size,
        quality: payload.quality,
        openai_created: image.created ?? null,
        revised_prompt: image.data?.[0]?.revised_prompt ?? null,
        brand_kit_id: brandKit?.id ?? null
      }
    });
    await recordSuccessfulUsage(user.id, "image_generations");
    logger.info("Image generation completed", {
      userId: user.id,
      generationId: generation.id,
      durationMs: Date.now() - startedAt,
      size: payload.size,
      quality: payload.quality
    });
    const [signedUrl, downloadUrl] = await Promise.all([
      createSignedImageUrl(storagePath),
      createSignedDownloadUrl(storagePath)
    ]);

    return NextResponse.json(
      {
        id: generation.id,
        prompt: payload.prompt,
        projectId: payload.projectId ?? null,
        storagePath,
        signedUrl,
        downloadUrl
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Image generation failed";
    await updateImageGeneration(supabase, generation.id, user.id, {
      status: "failed",
      error_message: message
    });
    logger.error("Image generation failed", {
      userId: user.id,
      generationId: generation.id,
      durationMs: Date.now() - startedAt,
      error: message
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
