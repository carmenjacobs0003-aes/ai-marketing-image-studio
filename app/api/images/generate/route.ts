import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { injectBrandIntoImagePrompt } from "@/lib/brand/prompt";
import {
  createMarketingImage,
  extractGeneratedImagePayload,
  getOpenAIDebugReason,
  getOpenAIErrorDiagnostics,
  isSupportedImageModel,
  moderateImagePrompt
} from "@/lib/openai/images";
import { rateLimit } from "@/lib/rate-limit";
import {
  createPollinationsImage,
  DEFAULT_POLLINATIONS_IMAGE_MODEL,
  PollinationsImageGenerationError
} from "@/lib/pollinations/images";
import { verifyRedisConnection } from "@/lib/redis/client";
import {
  uploadGeneratedImage,
  createSignedImageUrl,
  createSignedDownloadUrl
} from "@/lib/storage/images";
import {
  assertCanGenerateImage,
  isMissingMonthlyUsageSchemaError,
  recordSuccessfulUsage
} from "@/lib/usage/limits";
import {
  env,
  getDeploymentEnvironmentDiagnostics,
  OPENAI_API_KEY_ENV_VAR_NAME,
  POLLINATIONS_API_KEY_ENV_VAR_NAME
} from "@/lib/env";
import { logger } from "@/lib/logger";
import { recoverStaleGenerations } from "@/lib/recovery/generations";
import { ApiTimeoutError, withTimeout } from "@/lib/api/timeout";
import { logCentralizedError } from "@/lib/monitoring/errors";
import { enforcePromptProtection } from "@/lib/security/abuse";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createImageGeneration,
  listBrandKits,
  listProjects,
  updateImageGeneration,
  type BrandKit,
  type Project
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

function resolveImageBrandKit({
  explicitBrandKitId,
  project,
  brandKits
}: {
  explicitBrandKitId?: string;
  project: Project | null;
  brandKits: BrandKit[];
}) {
  const brandKitById = new Map(
    brandKits.map((brandKit) => [brandKit.id, brandKit])
  );

  if (explicitBrandKitId) {
    return {
      brandKit: brandKitById.get(explicitBrandKitId) ?? null,
      missingBrandKitId: explicitBrandKitId,
      source: "request" as const
    };
  }

  const fallbackBrandKitId =
    project?.brand_kit_id ?? brandKits.find((item) => item.is_default)?.id;

  return {
    brandKit: fallbackBrandKitId
      ? (brandKitById.get(fallbackBrandKitId) ?? null)
      : null,
    missingBrandKitId: fallbackBrandKitId ?? null,
    source: project?.brand_kit_id ? ("project" as const) : ("default" as const)
  };
}

const imageProviderSchema = z.enum(["openai", "pollinations"]);
type ImageGenerationProvider = z.infer<typeof imageProviderSchema>;

const requestSchema = z.object({
  prompt: z.string().trim().min(10).max(2000),
  projectId: z.string().uuid().optional(),
  brandKitId: z.string().uuid().optional(),
  provider: imageProviderSchema.default("openai"),
  model: z.string().trim().min(1).max(100).optional(),
  size: z.enum(["1024x1024", "1024x1792", "1792x1024"]).default("1024x1024"),
  quality: z.enum(["standard", "hd"]).default("standard"),
  seed: z.coerce.number().int().min(0).max(2147483647).optional()
});

const PUBLIC_IMAGE_GENERATION_UNAVAILABLE_MESSAGE =
  "Image generation is temporarily unavailable. Please try again shortly.";

type ImageGenerateResponse =
  | {
      success: true;
      id: string;
      prompt: string;
      projectId: string | null;
      signedUrl: string | null;
      downloadUrl: string | null;
      storagePath: string;
    }
  | {
      success: false;
      error: string;
      step?: string;
      publicError?: string;
      issues?: z.typeToFlattenedError<z.infer<typeof requestSchema>>;
      usage?: Awaited<ReturnType<typeof assertCanGenerateImage>>["usage"];
      diagnostics?: Record<string, unknown>;
      debugReason?: string;
    };

type ProviderImageResult =
  | {
      provider: "openai";
      imageResult: Awaited<ReturnType<typeof createMarketingImage>>;
      image: Awaited<ReturnType<typeof createMarketingImage>>["data"];
    }
  | {
      provider: "pollinations";
      imageResult: Awaited<ReturnType<typeof createPollinationsImage>>;
    };

function resolveSelectedModel(
  provider: ImageGenerationProvider,
  model?: string
) {
  if (provider === "pollinations") {
    return model?.trim() || DEFAULT_POLLINATIONS_IMAGE_MODEL;
  }

  return model?.trim() || env.OPENAI_IMAGE_MODEL;
}

function parseImageSize(size: z.infer<typeof requestSchema>["size"]) {
  const [width, height] = size.split("x").map(Number);

  return { width, height };
}

function createBypassedModeration(reason: string) {
  return {
    flagged: false,
    categories: {},
    categoryScores: {},
    moderationId: null,
    model: "none",
    requestCount: 0,
    latencyMs: 0,
    bypassed: true,
    bypassReason: reason
  };
}

function getProviderDebugReason(
  error: unknown,
  provider: ImageGenerationProvider
) {
  if (error instanceof ApiTimeoutError) {
    return `${provider}_request_timed_out`;
  }

  if (provider === "openai") {
    return getOpenAIDebugReason(error);
  }

  return "pollinations_request_failed";
}

function getProviderErrorStatus(
  error: unknown,
  provider: ImageGenerationProvider,
  openAIStatus?: number
) {
  if (
    provider === "pollinations" &&
    error instanceof PollinationsImageGenerationError
  ) {
    return error.status && error.status >= 400 ? error.status : 500;
  }

  return getErrorStatus(error, openAIStatus);
}

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
    deploymentEnvironment: getDeploymentEnvironmentDiagnostics(
      process.env,
      env
    ),
    openaiApiKeyEnvironmentVariable: OPENAI_API_KEY_ENV_VAR_NAME,
    hasOpenAIKey: Boolean(env.OPENAI_API_KEY),
    runtimeHasOpenAIKey: Boolean(process.env[OPENAI_API_KEY_ENV_VAR_NAME]),
    hasSupabaseUrl: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
    hasSupabaseAnonKey: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasSupabaseServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    openaiImageModel: env.OPENAI_IMAGE_MODEL,
    imageModelSupported: isSupportedImageModel(env.OPENAI_IMAGE_MODEL),
    apiTimeoutSeconds: env.API_TIMEOUT_SECONDS,
    openaiProjectConfigured: Boolean(env.OPENAI_PROJECT_ID),
    openaiOrganizationConfigured: Boolean(env.OPENAI_ORGANIZATION),
    pollinationsApiKeyEnvironmentVariable: POLLINATIONS_API_KEY_ENV_VAR_NAME,
    hasPollinationsKey: Boolean(env.POLLINATIONS_API_KEY),
    runtimeHasPollinationsKey: Boolean(
      process.env[POLLINATIONS_API_KEY_ENV_VAR_NAME]
    )
  };
}

function summarizeApiResponseForLog(body: ImageGenerateResponse) {
  if (!body.success) {
    return {
      success: false,
      error: body.error,
      step: body.step ?? null,
      publicError: body.publicError ?? null,
      hasIssues: Boolean(body.issues),
      hasUsage: Boolean(body.usage),
      debugReason: body.debugReason ?? null
    };
  }

  return {
    success: true,
    id: body.id,
    projectId: body.projectId,
    hasSignedUrl: Boolean(body.signedUrl),
    hasDownloadUrl: Boolean(body.downloadUrl),
    hasStoragePath: Boolean(body.storagePath),
    promptLength: body.prompt.length
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
    responseBody: summarizeApiResponseForLog(body),
    ...extra
  });
}

function isDevelopmentDebugResponse() {
  return process.env.NODE_ENV !== "production";
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

function jsonDebugError(
  request: NextRequest,
  startedAt: number,
  step: string,
  exactError: string,
  status: number,
  publicError = exactError,
  extra: Omit<
    Extract<ImageGenerateResponse, { success: false }>,
    "success" | "error" | "step" | "publicError"
  > = {},
  logExtra: Record<string, unknown> = {}
) {
  return jsonError(
    request,
    startedAt,
    exactError,
    status,
    {
      ...extra,
      step,
      publicError
    },
    {
      ...logExtra,
      step,
      exactError,
      publicError
    }
  );
}

async function readRequestJson(request: NextRequest) {
  logger.info("Image generation request JSON parsing start", {
    ...getRequestLogContext(request)
  });

  try {
    const data = await request.json();
    logger.info("Image generation request JSON parsing completed", {
      ...getRequestLogContext(request),
      bodyType: Array.isArray(data) ? "array" : typeof data
    });
    return { ok: true as const, data };
  } catch (error) {
    const message = getInternalFailureMessage(error);
    logger.warn("Invalid image generation request JSON", {
      ...getRequestLogContext(request),
      step: "json_parsing",
      error: message
    });
    return { ok: false as const, error: message };
  }
}

function toJsonMetadata(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function serializeErrorForDiagnostics(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const errorLike = error as Error & {
      cause?: unknown;
      status?: unknown;
      code?: unknown;
      type?: unknown;
      param?: unknown;
      request_id?: unknown;
    };

    return {
      name: error.name,
      message: sanitizeErrorMessage(error.message),
      stack: error.stack ? sanitizeErrorMessage(error.stack) : null,
      cause:
        errorLike.cause instanceof Error
          ? {
              name: errorLike.cause.name,
              message: sanitizeErrorMessage(errorLike.cause.message),
              stack: errorLike.cause.stack
                ? sanitizeErrorMessage(errorLike.cause.stack)
                : null
            }
          : (errorLike.cause ?? null),
      status: errorLike.status ?? null,
      code: errorLike.code ?? null,
      type: errorLike.type ?? null,
      param: errorLike.param ?? null,
      requestId: errorLike.request_id ?? null
    };
  }

  return {
    name: typeof error,
    message: sanitizeErrorMessage(String(error)),
    stack: null
  };
}

function sanitizeErrorMessage(message: string) {
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted_openai_key]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted_token]");
}

function getInternalFailureMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return sanitizeErrorMessage(error.message);
  }

  return sanitizeErrorMessage(String(error || "Image generation failed."));
}

function getErrorStatus(error: unknown, openAIStatus?: number) {
  if (error instanceof ApiTimeoutError) {
    return 504;
  }

  if (typeof openAIStatus === "number" && openAIStatus >= 400) {
    return openAIStatus;
  }

  return 500;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let userId: string | undefined;
  let generation: Awaited<ReturnType<typeof createImageGeneration>> | null =
    null;
  let supabase: ReturnType<typeof createSupabaseServerClient> | null = null;
  let currentStep = "request_start";
  let activeProvider: ImageGenerationProvider = "openai";

  try {
    currentStep = "environment_detection";
    logger.info("Image generation request received", {
      ...getRequestLogContext(request),
      env: getRuntimeEnvDiagnostics(),
      hasOpenAIKey: Boolean(env.OPENAI_API_KEY),
      runtimeHasOpenAIKey: Boolean(process.env[OPENAI_API_KEY_ENV_VAR_NAME])
    });

    currentStep = "authentication";
    const user = await getCurrentUser();
    userId = user?.id;

    logger.info("Image generation authenticated user resolved", {
      ...getRequestLogContext(request),
      userId: user?.id ?? null
    });

    if (!user) {
      return jsonDebugError(
        request,
        startedAt,
        currentStep,
        "Unauthorized",
        401
      );
    }

    currentStep = "json_parsing";
    const requestJson = await readRequestJson(request);

    if (!requestJson.ok) {
      return jsonDebugError(
        request,
        startedAt,
        currentStep,
        requestJson.error,
        400,
        "Invalid JSON request body"
      );
    }

    currentStep = "request_validation";
    const parsed = requestSchema.safeParse(requestJson.data);

    if (!parsed.success) {
      return jsonDebugError(
        request,
        startedAt,
        currentStep,
        parsed.error.message,
        400,
        "Invalid image generation request",
        {
          issues: parsed.error.flatten()
        }
      );
    }

    const payload = parsed.data;
    const selectedProvider = payload.provider;
    activeProvider = selectedProvider;
    const selectedModel = resolveSelectedModel(selectedProvider, payload.model);

    currentStep = "provider_model_validation";
    if (
      selectedProvider === "openai" &&
      !isSupportedImageModel(selectedModel)
    ) {
      logger.error(
        "Image generation attempted with unsupported OpenAI image model",
        {
          ...getRequestLogContext(request),
          userId: user.id,
          model: selectedModel
        }
      );
      return jsonDebugError(
        request,
        startedAt,
        currentStep,
        `Unsupported OpenAI image model: ${selectedModel}`,
        503,
        PUBLIC_IMAGE_GENERATION_UNAVAILABLE_MESSAGE
      );
    }

    currentStep = "provider_environment_validation";
    if (selectedProvider === "openai" && !env.OPENAI_API_KEY) {
      logger.error("Image generation attempted without OPENAI_API_KEY", {
        ...getRequestLogContext(request),
        userId: user.id,
        debugReason: "missing_openai_api_key",
        expectedEnvironmentVariable: OPENAI_API_KEY_ENV_VAR_NAME,
        env: getRuntimeEnvDiagnostics()
      });
      return jsonDebugError(
        request,
        startedAt,
        currentStep,
        `${OPENAI_API_KEY_ENV_VAR_NAME} is missing server-side`,
        503,
        PUBLIC_IMAGE_GENERATION_UNAVAILABLE_MESSAGE,
        {},
        { debugReason: "missing_openai_api_key" }
      );
    }

    if (selectedProvider === "pollinations" && !env.POLLINATIONS_API_KEY) {
      logger.error("Image generation attempted without POLLINATIONS_API_KEY", {
        ...getRequestLogContext(request),
        userId: user.id,
        debugReason: "missing_pollinations_api_key",
        expectedEnvironmentVariable: POLLINATIONS_API_KEY_ENV_VAR_NAME,
        env: getRuntimeEnvDiagnostics()
      });
      return jsonDebugError(
        request,
        startedAt,
        currentStep,
        `${POLLINATIONS_API_KEY_ENV_VAR_NAME} is missing server-side`,
        503,
        PUBLIC_IMAGE_GENERATION_UNAVAILABLE_MESSAGE,
        {},
        { debugReason: "missing_pollinations_api_key" }
      );
    }

    currentStep = "abuse_protection";
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
      return jsonDebugError(
        request,
        startedAt,
        currentStep,
        abuse.reason ?? "Blocked suspicious image generation request",
        429
      );
    }

    currentStep = "redis_connection";
    const redisVerification = await verifyRedisConnection({
      ...getRequestLogContext(request),
      userId: user.id
    });
    logger.info("Image generation Redis verification result", {
      ...getRequestLogContext(request),
      userId: user.id,
      redisVerification
    });

    currentStep = "queue_rate_limit";
    logger.info("Redis queue rate limit check start", {
      ...getRequestLogContext(request),
      userId: user.id,
      key: `generation-queue:${user.id}`,
      limit: env.GENERATION_QUEUE_LIMIT,
      windowSeconds: env.GENERATION_QUEUE_WINDOW_SECONDS
    });
    const queueLimiter = await rateLimit(
      `generation-queue:${user.id}`,
      env.GENERATION_QUEUE_LIMIT,
      env.GENERATION_QUEUE_WINDOW_SECONDS
    );

    logger.info("Redis queue rate limit check completed", {
      ...getRequestLogContext(request),
      userId: user.id,
      success: queueLimiter.success,
      degraded: queueLimiter.degraded,
      reset: queueLimiter.reset
    });

    if (queueLimiter.degraded) {
      logger.warn("Image generation queue rate limit used degraded fallback", {
        ...getRequestLogContext(request),
        userId: user.id
      });
    }

    if (!queueLimiter.success) {
      logger.warn("Image generation queue rate limit check denied request", {
        ...getRequestLogContext(request),
        userId: user.id,
        reset: queueLimiter.reset
      });
      return jsonDebugError(
        request,
        startedAt,
        currentStep,
        "Your generation queue is full. Please wait before starting another.",
        429
      );
    }

    currentStep = "image_rate_limit";
    logger.info("Redis image rate limit check start", {
      ...getRequestLogContext(request),
      userId: user.id,
      key: `images:${user.id}`,
      limit: env.IMAGE_GENERATION_RATE_LIMIT,
      windowSeconds: env.IMAGE_GENERATION_RATE_LIMIT_WINDOW_SECONDS
    });
    const limiter = await rateLimit(
      `images:${user.id}`,
      env.IMAGE_GENERATION_RATE_LIMIT,
      env.IMAGE_GENERATION_RATE_LIMIT_WINDOW_SECONDS
    );

    logger.info("Redis image rate limit check completed", {
      ...getRequestLogContext(request),
      userId: user.id,
      success: limiter.success,
      degraded: limiter.degraded,
      reset: limiter.reset
    });

    if (limiter.degraded) {
      logger.warn("Image generation user rate limit used degraded fallback", {
        ...getRequestLogContext(request),
        userId: user.id
      });
    }

    if (!limiter.success) {
      logger.warn("Image generation user rate limit check denied request", {
        ...getRequestLogContext(request),
        userId: user.id,
        reset: limiter.reset
      });
      return jsonDebugError(
        request,
        startedAt,
        currentStep,
        "Rate limit exceeded",
        429
      );
    }

    currentStep = "usage_entitlement";
    const entitlement = await assertCanGenerateImage(user.id);

    if (!entitlement.allowed) {
      return jsonDebugError(
        request,
        startedAt,
        currentStep,
        entitlement.reason,
        402,
        entitlement.reason,
        {
          usage: entitlement.usage
        }
      );
    }

    logger.info("Image prompt moderation start for image generation", {
      ...getRequestLogContext(request),
      userId: user.id,
      promptLength: payload.prompt.length,
      expectedModerationCalls: 1,
      openaiProjectConfigured: Boolean(env.OPENAI_PROJECT_ID),
      openaiOrganizationConfigured: Boolean(env.OPENAI_ORGANIZATION)
    });
    currentStep = "prompt_moderation";
    const moderation = env.OPENAI_API_KEY
      ? await moderateImagePrompt(payload.prompt)
      : createBypassedModeration("openai_api_key_missing");
    logger.info("Image prompt moderation completed for image generation", {
      ...getRequestLogContext(request),
      userId: user.id,
      flagged: moderation.flagged,
      requestCount: moderation.requestCount,
      latencyMs: moderation.latencyMs,
      bypassed: moderation.bypassed,
      bypassReason: moderation.bypassReason ?? null,
      moderationId: moderation.moderationId,
      model: moderation.model
    });

    if (moderation.flagged) {
      return jsonDebugError(
        request,
        startedAt,
        currentStep,
        "This prompt was blocked by safety moderation. Please revise it and try again.",
        400
      );
    }

    currentStep = "supabase_connection";
    supabase = createSupabaseServerClient();
    logger.info("Supabase server client ready for image generation", {
      ...getRequestLogContext(request),
      userId: user.id,
      hasSupabaseUrl: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
      hasSupabaseAnonKey: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      hasSupabaseServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY)
    });

    currentStep = "stale_generation_recovery";
    await recoverStaleGenerations(supabase, { userId: user.id })
      .then((results) => {
        logger.info("Opportunistic stale generation recovery completed", {
          ...getRequestLogContext(request),
          userId: user.id,
          results
        });
      })
      .catch((recoveryError) => {
        logger.warn("Opportunistic stale generation recovery failed", {
          ...getRequestLogContext(request),
          userId: user.id,
          error:
            recoveryError instanceof Error
              ? recoveryError.message
              : "Unknown stale generation recovery failure"
        });
      });

    currentStep = "supabase_prerequisites";
    const [projects, brandKits] = await Promise.all([
      listProjects(supabase, user.id),
      listBrandKits(supabase, user.id)
    ]);

    const project = payload.projectId
      ? (projects.find((item) => item.id === payload.projectId) ?? null)
      : null;

    if (payload.projectId && !project) {
      return jsonDebugError(
        request,
        startedAt,
        currentStep,
        "Project not found",
        404
      );
    }

    const {
      brandKit,
      missingBrandKitId,
      source: brandKitSource
    } = resolveImageBrandKit({
      explicitBrandKitId: payload.brandKitId,
      project,
      brandKits
    });

    logger.info("Supabase generation prerequisites loaded", {
      ...getRequestLogContext(request),
      userId: user.id,
      projectCount: projects.length,
      brandKitCount: brandKits.length,
      selectedProjectId: project?.id ?? null,
      selectedBrandKitId: brandKit?.id ?? null,
      brandKitSource,
      missingBrandKitId: brandKit ? null : missingBrandKitId
    });

    if (payload.brandKitId && !brandKit) {
      return jsonDebugError(
        request,
        startedAt,
        currentStep,
        "Brand kit not found",
        404
      );
    }

    if (!payload.brandKitId && missingBrandKitId && !brandKit) {
      logger.warn(
        "Image generation continuing without missing fallback brand kit",
        {
          ...getRequestLogContext(request),
          userId: user.id,
          projectId: project?.id ?? null,
          missingBrandKitId,
          brandKitSource
        }
      );
    }

    logger.info("Supabase image generation insert start", {
      ...getRequestLogContext(request),
      userId: user.id,
      projectId: payload.projectId ?? null,
      brandKitId: brandKit?.id ?? null,
      provider: selectedProvider,
      model: selectedModel
    });

    currentStep = "supabase_generation_insert";
    generation = await createImageGeneration(supabase, {
      user_id: user.id,
      project_id: payload.projectId ?? null,
      ...(brandKit ? { brand_kit_id: brandKit.id } : {}),
      prompt: payload.prompt,
      model: selectedModel,
      status: "queued",
      metadata: toJsonMetadata({
        provider: selectedProvider,
        model: selectedModel,
        moderation,
        size: payload.size,
        quality: payload.quality,
        seed: payload.seed ?? null
      })
    });

    logger.info("Supabase image generation insert completed", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id,
      status: generation.status
    });

    currentStep = "supabase_generation_processing_update";
    await updateImageGeneration(supabase, generation.id, user.id, {
      status: "processing"
    });
    logger.info("Supabase image generation marked processing", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id
    });

    const brandedPrompt = injectBrandIntoImagePrompt(payload.prompt, brandKit);
    logger.info("Image provider request dispatching", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id,
      provider: selectedProvider,
      model: selectedModel,
      size: payload.size,
      quality: payload.quality,
      promptLength: brandedPrompt.length,
      seed: payload.seed ?? null,
      hasOpenAIKey: Boolean(env.OPENAI_API_KEY),
      hasPollinationsKey: Boolean(env.POLLINATIONS_API_KEY),
      runtimeHasOpenAIKey: Boolean(process.env[OPENAI_API_KEY_ENV_VAR_NAME]),
      runtimeHasPollinationsKey: Boolean(
        process.env[POLLINATIONS_API_KEY_ENV_VAR_NAME]
      ),
      apiTimeoutSeconds: env.API_TIMEOUT_SECONDS,
      endpoint:
        selectedProvider === "openai"
          ? "POST /v1/images/generations"
          : "GET https://gen.pollinations.ai/image/{prompt}",
      sdkMethod:
        selectedProvider === "openai" ? "openai.images.generate" : "fetch"
    });
    currentStep = `${selectedProvider}_image_generation`;
    const { width, height } = parseImageSize(payload.size);
    let providerImage: ProviderImageResult;

    if (selectedProvider === "openai") {
      const imageResult = await withTimeout(
        createMarketingImage({
          prompt: brandedPrompt,
          size: payload.size,
          quality: payload.quality,
          userId: user.id,
          model: selectedModel
        }),
        env.API_TIMEOUT_SECONDS * 1000
      );
      providerImage = {
        provider: "openai",
        imageResult,
        image: imageResult.data
      };
    } else {
      const imageResult = await withTimeout(
        createPollinationsImage({
          prompt: brandedPrompt,
          model: selectedModel,
          width,
          height,
          seed: payload.seed
        }),
        env.API_TIMEOUT_SECONDS * 1000
      );
      providerImage = { provider: "pollinations", imageResult };
    }

    logger.info("Image provider response received", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id,
      provider: selectedProvider,
      status: providerImage.imageResult.status,
      statusText: providerImage.imageResult.statusText,
      ok: providerImage.imageResult.ok,
      requestId:
        providerImage.provider === "openai"
          ? providerImage.imageResult.requestId
          : null,
      responseSummary:
        providerImage.provider === "openai"
          ? providerImage.imageResult.responseSummary
          : {
              contentType: providerImage.imageResult.contentType,
              width: providerImage.imageResult.width,
              height: providerImage.imageResult.height
            },
      modelAccessDenied: false,
      billingOrQuotaError: false,
      timedOut: false
    });

    currentStep = `${selectedProvider}_payload_parsing`;
    logger.info("Image provider payload parsing start", {
      ...getRequestLogContext(request),
      userId: user.id,
      provider: selectedProvider,
      generationId: generation.id,
      requestId:
        providerImage.provider === "openai"
          ? providerImage.imageResult.requestId
          : null
    });
    const imagePayload =
      providerImage.provider === "openai"
        ? await extractGeneratedImagePayload(providerImage.image, {
            ...getRequestLogContext(request),
            userId: user.id,
            generationId: generation.id,
            openaiRequestId: providerImage.imageResult.requestId
          })
        : {
            base64: providerImage.imageResult.base64,
            source: "base64" as const,
            contentType: providerImage.imageResult.contentType,
            revisedPrompt: null
          };
    const base64Image = imagePayload.base64;
    logger.info("Image provider payload parsing completed", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id,
      source: imagePayload.source,
      base64Length: base64Image.length,
      contentType: imagePayload.contentType ?? null
    });
    logger.info("Image provider payload validated", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id,
      source: imagePayload.source,
      base64Length: base64Image.length,
      contentType: imagePayload.contentType ?? null
    });
    logger.info("Supabase storage upload start", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id
    });
    currentStep = "supabase_upload";
    const storagePath = await uploadGeneratedImage(
      user.id,
      generation.id,
      base64Image,
      imagePayload.contentType ?? "image/png"
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
    currentStep = "supabase_generation_completion_update";
    await updateImageGeneration(supabase, generation.id, user.id, {
      status: "completed",
      storage_path: storagePath,
      metadata: toJsonMetadata({
        moderation,
        provider: selectedProvider,
        model: selectedModel,
        size: payload.size,
        width,
        height,
        quality: payload.quality,
        seed: payload.seed ?? null,
        openai_created:
          providerImage.provider === "openai"
            ? (providerImage.image.created ?? null)
            : null,
        revised_prompt: imagePayload.revisedPrompt ?? null,
        openai_payload_source:
          providerImage.provider === "openai" ? imagePayload.source : null,
        openai_payload_content_type:
          providerImage.provider === "openai"
            ? (imagePayload.contentType ?? null)
            : null,
        openai_request_id:
          providerImage.provider === "openai"
            ? (providerImage.imageResult.requestId ?? null)
            : null,
        openai_status:
          providerImage.provider === "openai"
            ? providerImage.imageResult.status
            : null,
        openai_usage:
          providerImage.provider === "openai"
            ? (providerImage.image.usage ?? null)
            : null,
        pollinations_status:
          providerImage.provider === "pollinations"
            ? providerImage.imageResult.status
            : null,
        pollinations_content_type:
          providerImage.provider === "pollinations"
            ? providerImage.imageResult.contentType
            : null
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
      counter: "monthly_pooled_generations"
    });
    currentStep = "usage_recording";
    try {
      await recordSuccessfulUsage(user.id, 1, "image_generations");
      logger.info("Usage counter increment completed", {
        ...getRequestLogContext(request),
        userId: user.id,
        generationId: generation.id,
        counter: "monthly_pooled_generations"
      });
    } catch (usageError) {
      const schemaDrift = isMissingMonthlyUsageSchemaError(usageError);
      logger.error("Usage recording failed after completed image generation", {
        ...getRequestLogContext(request),
        userId: user.id,
        generationId: generation.id,
        storagePath,
        counter: "monthly_pooled_generations",
        completedImagePreserved: true,
        operationalIssue: schemaDrift
          ? "monthly_usage_schema_or_rpc_missing"
          : "usage_recording_failed_after_completion",
        error:
          usageError instanceof Error ? usageError.message : String(usageError)
      });
    }

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
    currentStep = "supabase_signed_urls";
    const [signedUrlResult, downloadUrlResult] = await Promise.allSettled([
      createSignedImageUrl(storagePath),
      createSignedDownloadUrl(storagePath)
    ]);
    const signedUrl =
      signedUrlResult.status === "fulfilled" ? signedUrlResult.value : null;
    const downloadUrl =
      downloadUrlResult.status === "fulfilled" ? downloadUrlResult.value : null;

    if (signedUrlResult.status === "rejected") {
      logger.error("Supabase signed image URL creation failed after upload", {
        ...getRequestLogContext(request),
        userId: user.id,
        generationId: generation.id,
        storagePath,
        error:
          signedUrlResult.reason instanceof Error
            ? signedUrlResult.reason.message
            : String(signedUrlResult.reason)
      });
    }

    if (downloadUrlResult.status === "rejected") {
      logger.error(
        "Supabase signed download URL creation failed after upload",
        {
          ...getRequestLogContext(request),
          userId: user.id,
          generationId: generation.id,
          storagePath,
          error:
            downloadUrlResult.reason instanceof Error
              ? downloadUrlResult.reason.message
              : String(downloadUrlResult.reason)
        }
      );
    }

    logger.info("Supabase signed URL creation completed", {
      ...getRequestLogContext(request),
      userId: user.id,
      generationId: generation.id,
      storagePath,
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
    const message = getInternalFailureMessage(error);
    const errorDiagnostics = serializeErrorForDiagnostics(error);
    const openaiDiagnostics = getOpenAIErrorDiagnostics(error);
    const failedProvider = activeProvider;
    const debugReason = getProviderDebugReason(error, failedProvider);

    logger.error("Image generation failed", {
      ...getRequestLogContext(request),
      userId,
      generationId: generation?.id,
      durationMs: Date.now() - startedAt,
      step: currentStep,
      error: message,
      errorDiagnostics,
      stack: errorDiagnostics.stack,
      debugReason,
      openaiDiagnostics,
      exactThrownErrorMessage:
        error instanceof Error ? error.message : String(error),
      hasOpenAIKey: Boolean(env.OPENAI_API_KEY),
      runtimeHasOpenAIKey: Boolean(process.env[OPENAI_API_KEY_ENV_VAR_NAME]),
      modelAccessDenied:
        debugReason === "openai_model_access_or_permission_denied",
      billingOrQuotaError: debugReason === "openai_billing_or_quota_failure",
      timedOut:
        debugReason === "openai_request_timed_out" ||
        debugReason === "pollinations_request_timed_out"
    });

    if (debugReason === "openai_model_access_or_permission_denied") {
      logger.error("Image generation failed due to OpenAI model access", {
        ...getRequestLogContext(request),
        userId,
        generationId: generation?.id,
        step: currentStep,
        errorDiagnostics,
        debugReason,
        openaiDiagnostics
      });
    }

    if (debugReason === "openai_request_timed_out") {
      logger.error("Image generation failed due to OpenAI request timeout", {
        ...getRequestLogContext(request),
        userId,
        generationId: generation?.id,
        step: currentStep,
        timeoutSeconds: env.API_TIMEOUT_SECONDS,
        debugReason,
        openaiDiagnostics
      });
    }

    if (
      debugReason === "openai_authentication_failed" ||
      debugReason === "openai_billing_or_quota_failure"
    ) {
      logger.error(
        "Image generation failed due to OpenAI billing/authentication",
        {
          ...getRequestLogContext(request),
          userId,
          generationId: generation?.id,
          step: currentStep,
          debugReason,
          openaiDiagnostics
        }
      );
    }

    if (supabase && generation && userId && currentStep !== "usage_recording") {
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
    } else if (generation && currentStep === "usage_recording") {
      logger.error(
        "Preserving completed image generation after usage recording failure",
        {
          ...getRequestLogContext(request),
          userId,
          generationId: generation.id,
          step: currentStep,
          completedImagePreserved: true
        }
      );
    }

    await logCentralizedError(error, {
      category: "generation",
      provider: failedProvider,
      message,
      userId,
      requestId: request.headers.get("x-request-id"),
      severity: "critical",
      context: {
        durationMs: Date.now() - startedAt,
        generationId: generation?.id,
        step: currentStep,
        errorDiagnostics,
        debugReason,
        openaiDiagnostics
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

    return jsonDebugError(
      request,
      startedAt,
      currentStep,
      message,
      getProviderErrorStatus(error, failedProvider, openaiDiagnostics.status),
      debugReason === "openai_billing_or_quota_failure"
        ? "Unavailable. Try selecting Pollinations in the Studio provider menu and generate again."
        : message,
      {
        debugReason,
        diagnostics: isDevelopmentDebugResponse()
          ? {
              step: currentStep,
              error: errorDiagnostics,
              openai: openaiDiagnostics,
              hasOpenAIKey: Boolean(env.OPENAI_API_KEY),
              runtimeHasOpenAIKey: Boolean(
                process.env[OPENAI_API_KEY_ENV_VAR_NAME]
              ),
              modelAccessDenied:
                debugReason === "openai_model_access_or_permission_denied",
              billingOrQuotaError:
                debugReason === "openai_billing_or_quota_failure",
              timedOut:
                debugReason === "openai_request_timed_out" ||
                debugReason === "pollinations_request_timed_out",
              debugReason
            }
          : undefined
      },
      {
        generationId: generation?.id,
        debugReason,
        openaiDiagnostics
      }
    );
  }
}
