import { NextResponse, type NextRequest } from "next/server";
import type { ImagesResponse } from "openai/resources/images";
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
import { ApiTimeoutError, withTimeout } from "@/lib/api/timeout";
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

type ImageGenerationErrorResponse = {
  success: false;
  error: string;
  retryable?: boolean;
  usage?: unknown;
};

function jsonError(
  message: string,
  status = 500,
  details: Omit<ImageGenerationErrorResponse, "success" | "error"> = {}
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...details
    },
    { status }
  );
}

function getErrorMessage(error: unknown, fallback = "Image generation failed") {
  return error instanceof Error ? error.message : fallback;
}

function logImageGeneration(event: string, metadata: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      event,
      route: "/api/images/generate",
      timestamp: new Date().toISOString(),
      ...metadata
    })
  );
}

function summarizeOpenAIImageResponse(
  image: ImagesResponse | null | undefined
) {
  return {
    hasResponse: Boolean(image),
    created: image?.created ?? null,
    dataCount: Array.isArray(image?.data) ? image.data.length : 0,
    firstItemKeys: image?.data?.[0] ? Object.keys(image.data[0]) : [],
    hasBase64: Boolean(image?.data?.[0]?.b64_json),
    hasUrl: Boolean(image?.data?.[0]?.url),
    revisedPromptLength: image?.data?.[0]?.revised_prompt?.length ?? 0
  };
}

async function safelyLogCentralizedError(
  error: unknown,
  metadata: Parameters<typeof logCentralizedError>[1]
) {
  try {
    await logCentralizedError(error, metadata);
  } catch (loggingError) {
    logImageGeneration("centralized_error_logging_failure", {
      originalMessage: getErrorMessage(error),
      loggingError: getErrorMessage(loggingError)
    });
  }
}

function validateOpenAIImageResponse(
  image: ImagesResponse | null | undefined
): asserts image is ImagesResponse {
  if (!image || typeof image !== "object") {
    throw new Error("OpenAI returned an empty image response.");
  }

  if (!Array.isArray(image.data)) {
    throw new Error("OpenAI image response is missing a data array.");
  }

  if (!image.data[0]) {
    throw new Error("OpenAI image response did not include an image item.");
  }

  if (!image.data[0].b64_json) {
    throw new Error("OpenAI image response did not include base64 image data.");
  }
}

export async function POST(request: NextRequest) {
  let userId: string | undefined;
  let generationId: string | undefined;

  logImageGeneration("request_start", {
    method: request.method,
    path: request.nextUrl.pathname,
    ip: getClientIp(request),
    openaiConfigured: Boolean(env.OPENAI_API_KEY),
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelRegion: process.env.VERCEL_REGION ?? null
  });

  try {
    if (!env.OPENAI_API_KEY) {
      logImageGeneration("missing_openai_api_key", {
        vercel: process.env.VERCEL === "1",
        vercelEnv: process.env.VERCEL_ENV ?? null
      });

      return jsonError(
        "OpenAI is not configured. Set OPENAI_API_KEY in your Vercel environment variables.",
        503,
        { retryable: false }
      );
    }

    const user = await getCurrentUser();
    userId = user?.id;

    if (!user) {
      return jsonError("Unauthorized", 401, { retryable: false });
    }

    const json = await request.json().catch((error) => {
      logImageGeneration("request_json_parse_failure", {
        userId,
        error: getErrorMessage(error, "Unable to parse request JSON")
      });
      return null;
    });
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
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
      return jsonError(
        abuse.reason ?? "Blocked suspicious image generation request",
        429,
        { retryable: true }
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
        429,
        { retryable: true }
      );
    }

    const limiter = await rateLimit(
      `images:${user.id}`,
      env.IMAGE_GENERATION_RATE_LIMIT,
      env.IMAGE_GENERATION_RATE_LIMIT_WINDOW_SECONDS
    );

    if (!limiter.success) {
      return jsonError("Rate limit exceeded", 429, { retryable: true });
    }

    const entitlement = await assertCanGenerateImage(user.id);

    if (!entitlement.allowed) {
      return jsonError(entitlement.reason, 402, { retryable: false });
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
      return jsonError("This prompt was blocked by safety moderation.", 400, {
        retryable: false
      });
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
    generationId = generation.id;

    await updateImageGeneration(supabase, generation.id, user.id, {
      status: "processing"
    });

    const brandedPrompt = injectBrandIntoImagePrompt(payload.prompt, brandKit);

    let image: ImagesResponse;

    try {
      image = await withTimeout(
        createMarketingImage({
          prompt: brandedPrompt,
          size: payload.size,
          quality: payload.quality
        }),
        env.API_TIMEOUT_SECONDS * 1000
      );

      logImageGeneration("openai_response", {
        userId: user.id,
        generationId: generation.id,
        response: summarizeOpenAIImageResponse(image)
      });

      try {
        validateOpenAIImageResponse(image);
      } catch (validationError) {
        logImageGeneration("openai_response_validation_failure", {
          userId: user.id,
          generationId: generation.id,
          response: summarizeOpenAIImageResponse(image),
          error: getErrorMessage(validationError)
        });
        throw validationError;
      }
    } catch (openaiError) {
      const message = getErrorMessage(
        openaiError,
        "OpenAI image generation failed"
      );

      logImageGeneration("openai_failure_fallback_response", {
        userId: user.id,
        generationId: generation.id,
        error: message,
        timeout: openaiError instanceof ApiTimeoutError
      });

      try {
        await updateImageGeneration(supabase, generation.id, user.id, {
          status: "failed",
          error_message: message
        });
      } catch (updateError) {
        logImageGeneration("openai_failure_status_update_error", {
          userId: user.id,
          generationId: generation.id,
          error: getErrorMessage(updateError)
        });
      }

      await safelyLogCentralizedError(openaiError, {
        category: "generation",
        provider: "openai",
        message,
        userId: user.id
      });

      return jsonError(
        "Image generation provider failed. Please try again in a moment.",
        openaiError instanceof ApiTimeoutError ? 504 : 502,
        { retryable: true }
      );
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
    const message = getErrorMessage(error);

    logImageGeneration("thrown_exception", {
      userId,
      generationId,
      error: message,
      stack: error instanceof Error ? error.stack : undefined
    });

    if (userId && generationId) {
      try {
        await updateImageGeneration(
          createSupabaseServerClient(),
          generationId,
          userId,
          {
            status: "failed",
            error_message: message
          }
        );
      } catch (updateError) {
        logImageGeneration("failure_status_update_error", {
          userId,
          generationId,
          error: getErrorMessage(updateError)
        });
      }
    }

    await safelyLogCentralizedError(error, {
      category: "generation",
      provider: "openai",
      message,
      userId
    });

    return jsonError(message, 500, { retryable: true });
  }
}
