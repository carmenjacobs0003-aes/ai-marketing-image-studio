import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { injectBrandIntoImagePrompt } from "@/lib/brand/prompt";
import {
  createMarketingImage,
  getGeneratedImageBase64,
  isSupportedImageModel,
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

export const runtime = "nodejs";

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

function getRequestLogContext(request: NextRequest) {
  return {
    requestId: request.headers.get("x-request-id"),
    method: request.method,
    path: request.nextUrl.pathname,
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    vercelEnv: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    vercelRegion: process.env.VERCEL_REGION ?? "local"
  };
}

function getRuntimeEnvDiagnostics() {
  return {
    hasOpenAIKey: Boolean(env.OPENAI_API_KEY),
    hasSupabaseUrl: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
    hasSupabaseAnonKey: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasSupabaseServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    openaiImageModel: env.OPENAI_IMAGE_MODEL,
    imageModelSupported: isSupportedImageModel(env.OPENAI_IMAGE_MODEL),
    apiTimeoutSeconds: env.API_TIMEOUT_SECONDS
  };
}

function logFinalApiResponse(
  request: NextRequest,
  status: number,
  body: ImageGenerateResponse,
  startedAt: number,
  extra: Record<string, unknown> = {}
) {
  logger.info("Image generation final API response", {
    ...getRequestLogContext(request),
    status,
    durationMs: Date.now() - startedAt,
    responseBody: body,
    ...extra
  });
}

function jsonError(
  request: NextRequest,
  startedAt: number,
  error: string,
  status: number,
  extra: Omit<
    Extract<ImageGenerateResponse, { success: false }>,
    "success" | "error"
  > = {},
  logExtra: Record<string, unknown> = {}
) {
  const body: ImageGenerateResponse = { success: false, error, ...extra };
  logFinalApiResponse(request, status, body, startedAt, logExtra);
  return NextResponse.json<ImageGenerateResponse>(body, { status });
}

async function readRequestJson(request: NextRequest) {
  try {
    return { ok: true as const, data: await request.json() };
  } catch (error) {
    logger.warn("Invalid image generation request JSON", {
      error:
        error instanceof Error ? error.message : "Unable to parse request JSON",
      requestId: request.headers.get("x-request-id")
    });
    return { ok: false as const };
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
    logger.info("Image generation request received", {
      ...getRequestLogContext(request),
      env: getRuntimeEnvDiagnostics()
    });

    const user = await getCurrentUser();
    userId = user?.id;

    logger.info("Image generation authenticated user resolved", {
      ...getRequestLogContext(request),
      userId: user?.id ?? null
    });

    if (!user) {
      return jsonError(request, startedAt, "Unauthorized", 401);
    }

    const requestJson = await readRequestJson(request);

    if (!requestJson.ok) {
      return jsonError(request, startedAt, "Invalid JSON request body", 400);
    }

    const parsed = requestSchema.safeParse(requestJson.data);

    if (!parsed.success) {
      return jsonError(
        request,
        startedAt,
        "Invalid image generation request",
        400,
        {
          issues: parsed.error.flatten()
        }
      );
    }

    const payload = parsed.data;

    if (!isSupportedImageModel(env.OPENAI_IMAGE_MODEL)) {
      logger.error(
        "Image generation attempted with unsupported OpenAI image model",
        {
          ...getRequestLogContext(request),
          userId: user.id,
          model: env.OPENAI_IMAGE_MODEL
        }
      );
      return jsonError(
        request,
        startedAt,
        "Image generation is configured with an unsupported OpenAI image model. Please contact support.",
        503
      );
    }

    if (!env.OPENAI_API_KEY) {
      logger.error("Image generation attempted without OPENAI_API_KEY", {
        userId: user.id,
        requestId: request.headers.get("x-request-id")
      });
      return jsonError(
        request,
        startedAt,
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
        request,
        startedAt,
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
        request,
        startedAt,
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
      return jsonError(request, startedAt, "Rate limit exceeded", 429);
    }

    const entitlement = await assertCanGenerateImage(user.id);

    if (!entitlement.allowed) {
      return jsonError(request, startedAt, entitlement.reason, 402, {
        usage: entitlement.usage
      });
    }

    supabase = createSupabaseServerClient();
    logger.info("Supabase server client ready for image generation", {
      ...getRequestLogContext(request),
      userId: user.id,
      hasSupabaseUrl: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
      hasSupabaseAnonKey: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      hasSupabaseServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY)
    });

    const [projects, brandKits] = await Promise.all([
      listProjects(supabase, user.id),
      listBrandKits(supabase, user.id)
    ]);

    const project = payload.projectId
      ? projects.find((item) => item.id === payload.projectId)
      : null;

    if (payload.projectId && !project) {
      return jsonError(request, startedAt, "Project not found", 404);
    }

    const selectedBrandKitId =
      payload.brandKitId ??
      project?.brand_kit_id ??
      brandKits.find((item) => item.is_default)?.id;

    const brandKit = selectedBrandKitId
      ? brandKits.find((item) => item.id === selectedBrandKitId)
      : null;

    logger.info("Supabase generation prerequisites loaded", {
      ...getRequestLogContext(request),
      userId: user.id,
      projectCount: projects.length,
      brandKitCount: brandKits.length,
      selectedProjectId: project?.id ?? null,
      selectedBrandKitId: brandKit?.id ?? null
    });

    if (selectedBrandKitId && !brandKit) {
      return jsonError(request, startedAt, "Brand kit not found", 404);
    }

    logger.info("OpenAI moderation start for image generation", {
      ...getRequestLogContext(request),
      userId: user.id,
      promptLength: payload.prompt.length
    });
    const moderation = await moderateImagePrompt(payload.prompt);
    logger.info("OpenAI moderation completed for image generation", {
      ...getRequestLogContext(request),
      userId: user.id,
      flagged: moderation.flagged
    });

    if (moderation.flagged) {
      return jsonError(
        request,
        startedAt,
        "This prompt was blocked by safety moderation. Please revise it and try again.",
        400
      );
    }

    logger.info("Supabase image generation insert start", {
      ...getRequestLogContext(request),
      userId: user.id,
      projectId: payload.projectId ?? null,
      brandKitId: brandKit?.id ?? null,
      model: env.OPENAI_IMAGE_MODEL
    });

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

    logger.info("Supabase image generation insert completed", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id,
      status: generation.status
    });

    await updateImageGeneration(supabase, generation.id, user.id, {
      status: "processing"
    });
    logger.info("Supabase image generation marked processing", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id
    });

    const brandedPrompt = injectBrandIntoImagePrompt(payload.prompt, brandKit);
    logger.info("OpenAI image request dispatching", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id,
      model: env.OPENAI_IMAGE_MODEL,
      size: payload.size,
      quality: payload.quality,
      promptLength: brandedPrompt.length
    });
    const imageResult = await withTimeout(
      createMarketingImage({
        prompt: brandedPrompt,
        size: payload.size,
        quality: payload.quality,
        userId: user.id
      }),
      env.API_TIMEOUT_SECONDS * 1000
    );
    const image = imageResult.data;

    logger.info("OpenAI image response parsed", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id,
      status: imageResult.status,
      requestId: imageResult.requestId,
      responseSummary: imageResult.responseSummary
    });

    const base64Image = getGeneratedImageBase64(image);
    logger.info("OpenAI image base64 payload validated", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id,
      base64Length: base64Image.length
    });
    logger.info("Supabase storage upload start", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id
    });
    const storagePath = await uploadGeneratedImage(
      user.id,
      generation.id,
      base64Image
    );
    logger.info("Supabase storage upload completed", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id,
      storagePath
    });

    logger.info("Supabase image generation completion update start", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id,
      storagePath
    });
    await updateImageGeneration(supabase, generation.id, user.id, {
      status: "completed",
      storage_path: storagePath,
      metadata: toJsonMetadata({
        moderation,
        size: payload.size,
        quality: payload.quality,
        openai_created: image.created ?? null,
        revised_prompt: image.data?.[0]?.revised_prompt ?? null,
        openai_request_id: imageResult.requestId ?? null,
        openai_status: imageResult.status,
        openai_usage: image.usage ?? null
      })
    });
    logger.info("Supabase image generation completion update completed", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id
    });

    logger.info("Usage counter increment start", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id,
      kind: "image_generations"
    });
    await recordSuccessfulUsage(user.id, "image_generations");
    logger.info("Usage counter increment completed", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id,
      kind: "image_generations"
    });

    logger.info("Image generation completed", {
      userId: user.id,
      generationId: generation.id,
      durationMs: Date.now() - startedAt
    });

    logger.info("Supabase signed URL creation start", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id,
      storagePath
    });
    const [signedUrl, downloadUrl] = await Promise.all([
      createSignedImageUrl(storagePath),
      createSignedDownloadUrl(storagePath)
    ]);
    logger.info("Supabase signed URL creation completed", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id,
      hasSignedUrl: Boolean(signedUrl),
      hasDownloadUrl: Boolean(downloadUrl)
    });

    const responseBody: ImageGenerateResponse = {
      success: true,
      id: generation.id,
      prompt: payload.prompt,
      projectId: payload.projectId ?? null,
      signedUrl,
      downloadUrl,
      storagePath
    };
    logFinalApiResponse(request, 201, responseBody, startedAt, {
      userId: user.id,
      generationId: generation.id
    });

    return NextResponse.json<ImageGenerateResponse>(responseBody, {
      status: 201
    });
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
    }).catch((loggingError) => {
      logger.error("Image generation centralized error logging failed", {
        userId,
        generationId: generation?.id,
        requestId: request.headers.get("x-request-id"),
        error:
          loggingError instanceof Error
            ? loggingError.message
            : "Unknown centralized logging failure"
      });
    });

    return jsonError(
      request,
      startedAt,
      message,
      500,
      {},
      {
        generationId: generation?.id
      }
    );
  }
}
