import type {
  ImagesResponse,
  ImageGenerateParams
} from "openai/resources/images";
import { env } from "@/lib/env";
import { createOpenAIClient } from "@/lib/openai/client";
import { normalizeFailureMessage, withRetry } from "@/lib/resilience";
import { logCentralizedError } from "@/lib/monitoring/errors";
import { logger } from "@/lib/logger";

type OpenAIErrorLike = {
  status?: unknown;
  code?: unknown;
  type?: unknown;
  param?: unknown;
  request_id?: unknown;
  headers?: unknown;
};

type ImageExtractionLogContext = Record<string, unknown>;

export type OpenAIErrorDiagnostics = {
  status?: number;
  code?: string;
  type?: string;
  param?: string;
  requestId?: string;
  message: string;
  isAuthOrPermissionIssue: boolean;
  isQuotaOrBillingIssue: boolean;
};

export type ImageModerationResult = {
  flagged: boolean;
  categories: unknown;
  categoryScores: unknown;
  moderationId: string | null;
  model: string;
  requestCount: number;
  latencyMs: number;
  bypassed: boolean;
  bypassReason?: string;
};

type OpenAIResponseHeaders = Record<string, string>;

export class OpenAIImageGenerationError extends Error {
  readonly diagnostics: OpenAIErrorDiagnostics;
  readonly debugReason: string;

  constructor(
    message: string,
    diagnostics: OpenAIErrorDiagnostics,
    debugReason: string
  ) {
    super(message);
    this.name = "OpenAIImageGenerationError";
    this.diagnostics = diagnostics;
    this.debugReason = debugReason;
  }
}

export type ImageGenerationSize =
  | "1024x1024"
  | "1024x1792"
  | "1792x1024"
  | "1024x1536"
  | "1536x1024"
  | "auto";
export type ImageGenerationQuality =
  | "standard"
  | "hd"
  | "low"
  | "medium"
  | "high"
  | "auto";

export type GenerateMarketingImageInput = {
  prompt: string;
  size?: ImageGenerationSize;
  quality?: ImageGenerationQuality;
  userId?: string;
};

export type ImageGenerationResult = {
  data: ImagesResponse;
  status: number;
  statusText: string;
  ok: boolean;
  requestId: string | null | undefined;
  model: string;
  request: ImageGenerateParams;
  responseSummary: ReturnType<typeof summarizeImagesResponse>;
};

export type GeneratedImagePayload = {
  base64: string;
  source: "base64" | "url";
  sourceUrl?: string;
  contentType?: string | null;
  revisedPrompt?: string | null;
};

const DALL_E_MODELS = new Set(["dall-e-2", "dall-e-3"]);
const GPT_IMAGE_MODELS = new Set([
  "gpt-image-1",
  "gpt-image-1-mini",
  "gpt-image-1.5",
  "gpt-image-2"
]);
const IMAGE_API_MODELS = new Set([...DALL_E_MODELS, ...GPT_IMAGE_MODELS]);
const DALL_E_3_QUALITIES = new Set(["standard", "hd"]);
const GPT_IMAGE_QUALITIES = new Set(["auto", "low", "medium", "high"]);

export function isSupportedImageModel(model: string) {
  return IMAGE_API_MODELS.has(model);
}

export function normalizeImageGenerationOptions(
  model: string,
  size: ImageGenerationSize = "1024x1024",
  quality: ImageGenerationQuality = "auto"
) {
  if (!isSupportedImageModel(model)) {
    throw new Error(
      `Unsupported OpenAI image model '${model}'. Use gpt-image-2, gpt-image-1.5, gpt-image-1-mini, gpt-image-1, dall-e-2, or dall-e-3.`
    );
  }

  if (GPT_IMAGE_MODELS.has(model)) {
    const normalizedSize =
      size === "1792x1024"
        ? "1536x1024"
        : size === "1024x1792"
          ? "1024x1536"
          : size;
    const normalizedQuality = GPT_IMAGE_QUALITIES.has(quality)
      ? quality
      : "auto";

    return {
      size: normalizedSize as ImageGenerateParams["size"],
      quality: normalizedQuality as ImageGenerateParams["quality"]
    };
  }

  if (model === "dall-e-3") {
    const normalizedSize =
      size === "1536x1024"
        ? "1792x1024"
        : size === "1024x1536"
          ? "1024x1792"
          : size === "auto"
            ? "1024x1024"
            : size;
    const normalizedQuality = DALL_E_3_QUALITIES.has(quality)
      ? quality
      : "standard";

    return {
      size: normalizedSize as ImageGenerateParams["size"],
      quality: normalizedQuality as ImageGenerateParams["quality"]
    };
  }

  return {
    size: "1024x1024" as ImageGenerateParams["size"],
    quality: "standard" as ImageGenerateParams["quality"]
  };
}

export function summarizeImagesResponse(
  image: ImagesResponse | null | undefined
) {
  return {
    created: image?.created ?? null,
    dataCount: Array.isArray(image?.data) ? image.data.length : 0,
    images: Array.isArray(image?.data)
      ? image.data.map((item, index) => ({
          index,
          hasBase64:
            typeof item.b64_json === "string" && item.b64_json.length > 0,
          base64Length:
            typeof item.b64_json === "string" ? item.b64_json.length : 0,
          hasUrl: typeof item.url === "string" && item.url.length > 0,
          revisedPromptLength:
            typeof item.revised_prompt === "string"
              ? item.revised_prompt.length
              : 0
        }))
      : [],
    usage: image?.usage ?? null
  };
}

function getOpenAIHeaders(error: unknown) {
  if (error && typeof error === "object" && "headers" in error) {
    const headers = (error as { headers?: unknown }).headers;

    if (headers && typeof headers === "object") {
      return Object.fromEntries(
        Object.entries(headers as Record<string, unknown>)
          .filter(([, value]) => typeof value === "string")
          .filter(([key]) =>
            /^(x-request-id|x-ratelimit|retry-after|openai-organization|openai-processing-ms)/i.test(
              key
            )
          )
      ) as OpenAIResponseHeaders;
    }
  }

  return {};
}

function getResponseHeaders(response: Response) {
  return Object.fromEntries(
    Array.from(response.headers.entries()).filter(([key]) =>
      /^(x-request-id|x-ratelimit|retry-after|openai-organization|openai-processing-ms)/i.test(
        key
      )
    )
  );
}

function getOpenAIStatus(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }

  return undefined;
}

export function getOpenAIErrorDiagnostics(
  error: unknown
): OpenAIErrorDiagnostics {
  if (error instanceof OpenAIImageGenerationError) {
    return error.diagnostics;
  }

  const errorLike =
    error && typeof error === "object" ? (error as OpenAIErrorLike) : {};

  return {
    status: typeof errorLike.status === "number" ? errorLike.status : undefined,
    code: typeof errorLike.code === "string" ? errorLike.code : undefined,
    type: typeof errorLike.type === "string" ? errorLike.type : undefined,
    param: typeof errorLike.param === "string" ? errorLike.param : undefined,
    requestId:
      typeof errorLike.request_id === "string"
        ? errorLike.request_id
        : undefined,
    message: error instanceof Error ? error.message : String(error),
    isAuthOrPermissionIssue:
      getOpenAIStatus(error) === 401 ||
      getOpenAIStatus(error) === 403 ||
      /api key|authorization|unauthorized|forbidden|permission|project|billing|quota|organization verification/i.test(
        error instanceof Error ? error.message : String(error)
      ),
    isQuotaOrBillingIssue:
      getOpenAIStatus(error) === 429 ||
      /billing|quota|insufficient_quota|rate limit/i.test(
        error instanceof Error ? error.message : String(error)
      )
  };
}

export function getOpenAIDebugReason(error: unknown) {
  if (error instanceof OpenAIImageGenerationError) {
    return error.debugReason;
  }

  const diagnostics = getOpenAIErrorDiagnostics(error);
  const normalized = [diagnostics.code, diagnostics.type, diagnostics.message]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    diagnostics.status === 401 ||
    /api key|authentication|unauthorized/.test(normalized)
  ) {
    return "openai_authentication_failed";
  }

  if (
    diagnostics.status === 403 ||
    /forbidden|permission|project|model.*access|organization verification/.test(
      normalized
    )
  ) {
    return "openai_model_access_or_permission_denied";
  }

  if (
    diagnostics.isQuotaOrBillingIssue ||
    /billing|quota|insufficient_quota|credits|payment/.test(normalized)
  ) {
    return "openai_billing_or_quota_failure";
  }

  if (diagnostics.status === 429 || /rate limit/.test(normalized)) {
    return "openai_rate_limited";
  }

  return "openai_request_failed";
}

export async function moderateImagePrompt(
  prompt: string
): Promise<ImageModerationResult> {
  const openai = createOpenAIClient();
  const model = "omni-moderation-latest";
  const startedAt = Date.now();
  let requestCount = 0;

  const moderation = await withRetry(
    async () => {
      requestCount += 1;
      const attemptStartedAt = Date.now();

      logger.info("OpenAI image moderation request start", {
        promptLength: prompt.length,
        model,
        requestCount,
        attempt: requestCount,
        projectConfigured: Boolean(env.OPENAI_PROJECT_ID),
        organizationConfigured: Boolean(env.OPENAI_ORGANIZATION),
        endpoint: "POST /v1/moderations"
      });

      const result = await openai.moderations
        .create(
          {
            model,
            input: prompt
          },
          { maxRetries: 0 }
        )
        .withResponse();
      const latencyMs = Date.now() - attemptStartedAt;

      logger.info("OpenAI image moderation response", {
        status: result.response.status,
        statusText: result.response.statusText,
        ok: result.response.ok,
        requestId: result.request_id,
        resultCount: result.data.results.length,
        requestCount,
        latencyMs,
        totalLatencyMs: Date.now() - startedAt,
        headers: getResponseHeaders(result.response)
      });
      return result.data;
    },
    {
      label: "openai.image_moderation",
      attempts: 2,
      baseDelayMs: env.PROVIDER_RETRY_BASE_DELAY_MS,
      maxDelayMs: env.PROVIDER_RETRY_MAX_DELAY_MS,
      retryableStatuses: [429],
      onRetry: (error, attempt, delayMs) => {
        logger.warn("OpenAI image moderation 429 retry scheduled", {
          attempt,
          nextAttempt: attempt + 1,
          delayMs,
          requestCount,
          status: getOpenAIStatus(error),
          headers: getOpenAIHeaders(error),
          latencyMs: Date.now() - startedAt
        });
      }
    }
  ).catch(async (error) => {
    const status = getOpenAIStatus(error);
    const latencyMs = Date.now() - startedAt;

    if (status === 429) {
      logger.warn(
        "OpenAI image moderation rate limited after retry; bypassing moderation for this request",
        {
          status,
          requestCount,
          latencyMs,
          headers: getOpenAIHeaders(error),
          model,
          projectConfigured: Boolean(env.OPENAI_PROJECT_ID),
          organizationConfigured: Boolean(env.OPENAI_ORGANIZATION)
        }
      );

      return {
        results: [
          {
            flagged: false,
            categories: {},
            category_scores: {}
          }
        ],
        id: null
      };
    }

    await logCentralizedError(error, {
      category: "openai",
      provider: "openai",
      message: normalizeFailureMessage("OpenAI moderation", error),
      severity: "critical",
      context: {
        status,
        requestCount,
        latencyMs,
        headers: getOpenAIHeaders(error)
      }
    }).catch((loggingError) => {
      logger.error("OpenAI moderation centralized logging failed", {
        error:
          loggingError instanceof Error
            ? loggingError.message
            : "Unknown centralized logging failure"
      });
    });
    logger.error("OpenAI moderation request failed with original error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      status,
      requestCount,
      latencyMs,
      headers: getOpenAIHeaders(error)
    });
    throw error;
  });
  const result = moderation.results[0];

  if (!result) {
    throw new Error("Prompt moderation did not return a result.");
  }

  const bypassed = moderation.id === null;

  return {
    flagged: result.flagged,
    categories: result.categories,
    categoryScores: result.category_scores,
    moderationId: moderation.id ?? null,
    model,
    requestCount,
    latencyMs: Date.now() - startedAt,
    bypassed,
    bypassReason: bypassed ? "openai_moderation_rate_limited" : undefined
  };
}

export async function createMarketingImage({
  prompt,
  size = "1024x1024",
  quality = "auto",
  userId
}: GenerateMarketingImageInput): Promise<ImageGenerationResult> {
  const openai = createOpenAIClient();
  const model = env.OPENAI_IMAGE_MODEL;
  const normalized = normalizeImageGenerationOptions(model, size, quality);
  const request: ImageGenerateParams = {
    model,
    prompt,
    n: 1,
    size: normalized.size,
    quality: normalized.quality,
    user: userId,
    ...(DALL_E_MODELS.has(model) ? { response_format: "b64_json" } : {})
  };

  return withRetry(
    async () => {
      logger.info("OpenAI image generation request start", {
        model,
        size: request.size,
        quality: request.quality,
        promptLength: prompt.length,
        responseFormat: request.response_format ?? "model-default",
        userProvided: Boolean(userId),
        hasApiKey: Boolean(env.OPENAI_API_KEY),
        projectConfigured: Boolean(env.OPENAI_PROJECT_ID),
        organizationConfigured: Boolean(env.OPENAI_ORGANIZATION),
        endpoint: "POST /v1/images/generations",
        sdkMethod: "openai.images.generate"
      });
      const {
        data,
        response,
        request_id: requestId
      } = await openai.images
        .generate(request, { maxRetries: 0 })
        .withResponse();
      const responseSummary = summarizeImagesResponse(data);
      logger.info("OpenAI image generation response status", {
        model,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        requestId,
        headers: getResponseHeaders(response)
      });
      logger.info("OpenAI image generation raw response", {
        model,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        requestId,
        responseSummary
      });
      return {
        data,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        requestId,
        model,
        request,
        responseSummary
      };
    },
    { label: "openai.image_generation" }
  ).catch(async (error) => {
    const diagnostics = getOpenAIErrorDiagnostics(error);
    const status = diagnostics.status;
    const message = normalizeFailureMessage("OpenAI image generation", error);
    const debugReason = getOpenAIDebugReason(error);

    if (debugReason === "openai_model_access_or_permission_denied") {
      logger.error("OpenAI image generation model access error", {
        model,
        status,
        debugReason,
        diagnostics
      });
    }

    if (
      debugReason === "openai_authentication_failed" ||
      debugReason === "openai_billing_or_quota_failure"
    ) {
      logger.error("OpenAI image generation billing/authentication failure", {
        model,
        status,
        debugReason,
        diagnostics
      });
    }

    logger.error("OpenAI image generation request failed", {
      model,
      size,
      quality,
      status,
      error: error instanceof Error ? error.message : String(error),
      normalizedMessage: message,
      stack: error instanceof Error ? error.stack : null,
      debugReason,
      diagnostics
    });

    await logCentralizedError(error, {
      category: "openai",
      provider: "openai",
      message,
      severity: "critical",
      context: { model, size, quality, status, debugReason, diagnostics }
    }).catch((loggingError) => {
      logger.error("OpenAI image generation centralized logging failed", {
        model,
        size,
        quality,
        status,
        error:
          loggingError instanceof Error
            ? loggingError.message
            : "Unknown centralized logging failure"
      });
    });
    throw error;
  });
}

async function fetchImageUrlAsBase64(
  url: string,
  logContext: ImageExtractionLogContext
) {
  logger.info("OpenAI image URL payload fetch start", {
    ...logContext,
    sourceUrlHost: new URL(url).host
  });

  const response = await fetch(url);

  if (!response.ok) {
    logger.error("OpenAI image URL payload fetch failed", {
      ...logContext,
      status: response.status,
      statusText: response.statusText
    });
    throw new Error(
      "OpenAI returned an image URL that could not be downloaded."
    );
  }

  const contentType = response.headers.get("content-type");
  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length === 0) {
    logger.error("OpenAI image URL payload was empty", {
      ...logContext,
      contentType
    });
    throw new Error("OpenAI returned an empty image URL payload.");
  }

  logger.info("OpenAI image URL payload fetched", {
    ...logContext,
    contentType,
    byteLength: buffer.length
  });

  return { base64: buffer.toString("base64"), contentType };
}

export async function extractGeneratedImagePayload(
  image: ImagesResponse,
  logContext: ImageExtractionLogContext = {}
): Promise<GeneratedImagePayload> {
  logger.info("OpenAI image JSON payload parsing start", {
    ...logContext
  });
  const summary = summarizeImagesResponse(image);

  if (!image || !Array.isArray(image.data) || !image.data[0]) {
    logger.error("Invalid OpenAI image response: empty data", {
      ...logContext,
      debugReason: "invalid_openai_response_empty_data",
      responseSummary: summary
    });
    throw new Error("OpenAI returned an empty image response.");
  }

  const firstImage = image.data[0];
  const base64Image = firstImage.b64_json;

  if (typeof base64Image === "string" && base64Image.trim().length > 0) {
    logger.info("OpenAI image JSON payload parsing completed", {
      ...logContext,
      source: "base64",
      responseSummary: summary
    });
    logger.info("OpenAI image base64 payload extracted", {
      ...logContext,
      base64Length: base64Image.length,
      revisedPromptLength:
        typeof firstImage.revised_prompt === "string"
          ? firstImage.revised_prompt.length
          : 0
    });

    return {
      base64: base64Image,
      source: "base64",
      revisedPrompt: firstImage.revised_prompt ?? null
    };
  }

  if (typeof firstImage.url === "string" && firstImage.url.trim().length > 0) {
    const { base64, contentType } = await fetchImageUrlAsBase64(
      firstImage.url,
      logContext
    );

    logger.info("OpenAI image JSON payload parsing completed", {
      ...logContext,
      source: "url",
      responseSummary: summary
    });

    return {
      base64,
      source: "url",
      sourceUrl: firstImage.url,
      contentType,
      revisedPrompt: firstImage.revised_prompt ?? null
    };
  }

  logger.error("Invalid OpenAI image response: no usable payload", {
    ...logContext,
    debugReason: "invalid_openai_response_no_usable_payload",
    responseSummary: summary
  });
  throw new Error("OpenAI did not return a valid image payload.");
}

export async function getGeneratedImageBase64(image: ImagesResponse) {
  return (await extractGeneratedImagePayload(image)).base64;
}
