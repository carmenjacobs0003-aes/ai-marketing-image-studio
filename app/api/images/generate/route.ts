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
import { withTimeout } from "@/lib/api/timeout";
import { logCentralizedError } from "@/lib/monitoring/errors";
import { enforcePromptProtection } from "@/lib/security/abuse";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createImageGeneration,
  listBrandKits,
  listProjects,
  updateImageGeneration
} from "@/lib/db/queries";

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined
  );
}

const requestSchema = z.object({
  prompt: z.string().trim().min(10).max(2000),
  projectId: z.string().uuid().optional(),
  brandKitId: z.string().uuid().optional(),
  size: z.enum(["1024x1024", "1024x1792", "1792x1024"]).default("1024x1024"),
  quality: z.enum(["standard", "hd"]).default("standard")
});

export async function POST(request: NextRequest) {
  const _startedAt = Date.now();
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

  const abuse = await enforcePromptProtection({
    userId: user.id,
    prompt: payload.prompt,
    route: request.nextUrl.pathname,
    ip: getClientIp(request)
  });

  if (!abuse.allowed) {
    return NextResponse.json(
      {
        error:
          abuse.reason ??
          "Blocked suspicious image generation request"
      },
      { status: 429 }
    );
  }

  const queueLimiter = await rateLimit(
    `generation-queue:${user.id}`,
    env.GENERATION_QUEUE_LIMIT,
    env.GENERATION_QUEUE_WINDOW_SECONDS
  );

  if (!queueLimiter.success) {
    return NextResponse.json(
      {
        error:
          "Your generation queue is full. Please wait before starting another."
      },
      { status: 429 }
    );
  }

  const limiter = await rateLimit(
    `images:${user.id}`,
    env.IMAGE_GENERATION_RATE_LIMIT,
    env.IMAGE_GENERATION_RATE_LIMIT_WINDOW_SECONDS
  );

  if (!limiter.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  const entitlement = await assertCanGenerateImage(user.id);

  if (!entitlement.allowed) {
    return NextResponse.json(
      { error: entitlement.reason },
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

  const selectedBrandKitId =
    payload.brandKitId ??
    project?.brand_kit_id ??
    brandKits.find((item) => item.is_default)?.id;

  const brandKit = selectedBrandKitId
    ? brandKits.find((item) => item.id === selectedBrandKitId)
    : null;

  const moderation = await moderateImagePrompt(payload.prompt);

  if (moderation.flagged) {
    return NextResponse.json(
      {
        error:
          "This prompt was blocked by safety moderation."
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
    status: "queued",
    metadata: JSON.parse(
  JSON.stringify({
    moderation,
    size: payload.size,
    quality: payload.quality
  })
)
  });

  try {
    await updateImageGeneration(supabase, generation.id, user.id, {
      status: "processing"
    });

    const brandedPrompt = injectBrandIntoImagePrompt(
      payload.prompt,
      brandKit
    );

    const image = await withTimeout(
      createMarketingImage({
        prompt: brandedPrompt,
        size: payload.size,
        quality: payload.quality
      }),
      env.API_TIMEOUT_SECONDS * 1000
    );

    if (!image?.data?.[0]) {
      throw new Error("Invalid image response from OpenAI");
    }

    const base64Image = getGeneratedImageBase64(image);

    if (!base64Image) {
      throw new Error("No image data returned from OpenAI");
    }

    const storagePath = await uploadGeneratedImage(
      user.id,
      generation.id,
      base64Image
    );

    await updateImageGeneration(supabase, generation.id, user.id, {
  status: "completed",
  storage_path: storagePath,
  metadata: JSON.parse(
    JSON.stringify({
      moderation,
      size: payload.size,
      quality: payload.quality,
      openai_created: image.created ?? null,
      revised_prompt: image.data?.[0]?.revised_prompt ?? null
    })
  )
});

    await recordSuccessfulUsage(user.id, "image_generations");

    logger.info("Image generation completed", {
      userId: user.id,
      generationId: generation.id
    });

    const [signedUrl, downloadUrl] = await Promise.all([
      createSignedImageUrl(storagePath),
      createSignedDownloadUrl(storagePath)
    ]);

    return NextResponse.json(
      {
        id: generation.id,
        signedUrl,
        downloadUrl,
        storagePath
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Image generation failed";

    await updateImageGeneration(supabase, generation.id, user.id, {
      status: "failed",
      error_message: message
    });

    await logCentralizedError(error, {
      category: "generation",
      provider: "openai",
      message,
      userId: user.id
    });

    return NextResponse.json(
      {
        error: message
      },
      { status: 500 }
    );
  }
}
