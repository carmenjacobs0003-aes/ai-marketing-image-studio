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
import type { Json } from "@/lib/db/types";

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

type ImageGenerateResponse =
  | {
      success: true;
      id: string;
      prompt: string;
      projectId: string | null;
      signedUrl: string;
      downloadUrl: string;
      storagePath: string;
    }
  | {
      success: false;
      error: string;
      issues?: z.typeToFlattenedError<z.infer<typeof requestSchema>>;
      usage?: Awaited<ReturnType<typeof assertCanGenerateImage>>["usage"];
    };

function jsonError(
  error: string,
  status: number,
  extra: Omit<
    Extract<ImageGenerateResponse, { success: false }>,
    "success" | "error"
  > = {}
) {
  return NextResponse.json<ImageGenerateResponse>(
    { success: false, error, ...extra },
    { status }
  );
}

async function readRequestJson(request: NextRequest) {
  try {
    return await request.json();
  } catch (error) {
    logger.warn("Invalid image generation request JSON", {
      error:
        error instanceof Error ? error.message : "Unable to parse request JSON",
      requestId: request.headers.get("x-request-id")
    });
    return null;
  }
}

function toJsonMetadata(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function getImageGenerationFailureMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Image generation failed. Please try again.";
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let userId: string | undefined;
  let generation: Awaited<ReturnType<typeof createImageGeneration>> | null =
    null;
  let supabase: ReturnType<typeof createSupabaseServerClient> | null = null;

  try {
    const user = await getCurrentUser();
    userId = user?.id;

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const parsed = requestSchema.safeParse(await readRequestJson(request));

    if (!parsed.success) {
      return jsonError("Invalid image generation request", 400, {
        issues: parsed.error.flatten()
      });
    }

    const payload = parsed.data;

    if (!env.OPENAI_API_KEY) {
      logger.error("Image generation attempted without OPENAI_API_KEY", {
        userId: user.id,
        requestId: request.headers.get("x-request-id")
      });
      return jsonError(
        "Image generation is not configured. Please contact support.",
        503
      );
    }

    const abuse = await enforcePromptProtection({
      userId: user.id,
      prompt: payload.prompt,
      route: request.nextUrl.pathname,
      ip: getClientIp(request)
    });

    if (!abuse.allowed) {
      await logCentralizedError(new Error(abuse.reason), {
        category: "abuse",
        message: abuse.reason ?? "Blocked suspicious image generation request",
        userId: user.id,
        requestId: request.headers.get("x-request-id"),
        context: { score: abuse.score, signals: abuse.signals }
      });
      return jsonError(
        abuse.reason ?? "Blocked suspicious image generation request",
        429
      );
    }

    const queueLimiter = await rateLimit(
      `generation-queue:${user.id}`,
      env.GENERATION_QUEUE_LIMIT,
      env.GENERATION_QUEUE_WINDOW_SECONDS
    );

    if (!queueLimiter.success) {
      return jsonError(
        "Your generation queue is full. Please wait before starting another.",
        429
      );
    }

    const limiter = await rateLimit(
      `images:${user.id}`,
      env.IMAGE_GENERATION_RATE_LIMIT,
      env.IMAGE_GENERATION_RATE_LIMIT_WINDOW_SECONDS
    );

    if (!limiter.success) {
      return jsonError("Rate limit exceeded", 429);
    }

    const entitlement = await assertCanGenerateImage(user.id);

    if (!entitlement.allowed) {
      return jsonError(entitlement.reason, 402, { usage: entitlement.usage });
    }

    supabase = createSupabaseServerClient();

    const [projects, brandKits] = await Promise.all([
      listProjects(supabase, user.id),
      listBrandKits(supabase, user.id)
    ]);

    const project = payload.projectId
      ? projects.find((item) => item.id === payload.projectId)
      : null;

    if (payload.projectId && !project) {
      return jsonError("Project not found", 404);
    }

    const selectedBrandKitId =
      payload.brandKitId ??
      project?.brand_kit_id ??
      brandKits.find((item) => item.is_default)?.id;

    const brandKit = selectedBrandKitId
      ? brandKits.find((item) => item.id === selectedBrandKitId)
      : null;

    if (selectedBrandKitId && !brandKit) {
      return jsonError("Brand kit not found", 404);
    }

    const moderation = await moderateImagePrompt(payload.prompt);

    if (moderation.flagged) {
      return jsonError(
        "This prompt was blocked by safety moderation. Please revise it and try again.",
        400
      );
    }

    generation = await createImageGeneration(supabase, {
      user_id: user.id,
      project_id: payload.projectId ?? null,
      brand_kit_id: brandKit?.id ?? null,
      prompt: payload.prompt,
      model: env.OPENAI_IMAGE_MODEL,
      status: "queued",
      metadata: toJsonMetadata({
        moderation,
        size: payload.size,
        quality: payload.quality
      })
    });

    await updateImageGeneration(supabase, generation.id, user.id, {
      status: "processing"
    });

    const brandedPrompt = injectBrandIntoImagePrompt(payload.prompt, brandKit);
    const image = await withTimeout(
      createMarketingImage({
        prompt: brandedPrompt,
        size: payload.size,
        quality: payload.quality
      }),
      env.API_TIMEOUT_SECONDS * 1000
    );

    const base64Image = getGeneratedImageBase64(image);
    const storagePath = await uploadGeneratedImage(
      user.id,
      generation.id,
      base64Image
    );

    await updateImageGeneration(supabase, generation.id, user.id, {
      status: "completed",
      storage_path: storagePath,
      metadata: toJsonMetadata({
        moderation,
        size: payload.size,
        quality: payload.quality,
        openai_created: image.created ?? null,
        revised_prompt: image.data?.[0]?.revised_prompt ?? null
      })
    });

    await recordSuccessfulUsage(user.id, "image_generations");

    logger.info("Image generation completed", {
      userId: user.id,
      generationId: generation.id,
      durationMs: Date.now() - startedAt
    });

    const [signedUrl, downloadUrl] = await Promise.all([
      createSignedImageUrl(storagePath),
      createSignedDownloadUrl(storagePath)
    ]);

    return NextResponse.json<ImageGenerateResponse>(
      {
        success: true,
        id: generation.id,
        prompt: payload.prompt,
        projectId: payload.projectId ?? null,
        signedUrl,
        downloadUrl,
        storagePath
      },
      { status: 201 }
    );
  } catch (error) {
    const message = getImageGenerationFailureMessage(error);

    logger.error("Image generation failed", {
      userId,
      generationId: generation?.id,
      requestId: request.headers.get("x-request-id"),
      durationMs: Date.now() - startedAt,
      error: message
    });

    if (supabase && generation && userId) {
      await updateImageGeneration(supabase, generation.id, userId, {
        status: "failed",
        error_message: message
      }).catch((updateError) => {
        logger.error("Failed to mark image generation as failed", {
          userId,
          generationId: generation?.id,
          error:
            updateError instanceof Error
              ? updateError.message
              : "Unknown image generation status update failure"
        });
      });
    }

    await logCentralizedError(error, {
      category: "generation",
      provider: "openai",
      message,
      userId,
      requestId: request.headers.get("x-request-id"),
      severity: "critical",
      context: {
        durationMs: Date.now() - startedAt,
        generationId: generation?.id
      }
    });

    return jsonError(message, 500);
  }
}
