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
  "gpt-image-1.5"
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
      `Unsupported OpenAI image model '${model}'. Use gpt-image-1, gpt-image-1-mini, gpt-image-1.5, dall-e-2, or dall-e-3.`
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

function getOpenAIStatus(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }

  return undefined;
}

export function getOpenAIErrorDiagnostics(error: unknown) {
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

export async function moderateImagePrompt(prompt: string) {
  const openai = createOpenAIClient();
  const moderation = await withRetry(
    async () => {
      logger.info("OpenAI image moderation request start", {
        promptLength: prompt.length,
        model: "omni-moderation-latest"
      });
      const result = await openai.moderations
        .create({
          model: "omni-moderation-latest",
          input: prompt
        })
        .withResponse();
      logger.info("OpenAI image moderation response", {
        status: result.response.status,
        requestId: result.request_id,
        resultCount: result.data.results.length
      });
      return result.data;
    },
    { label: "openai.image_moderation" }
  ).catch(async (error) => {
    await logCentralizedError(error, {
      category: "openai",
      provider: "openai",
      message: normalizeFailureMessage("OpenAI moderation", error),
      severity: "critical",
      context: { status: getOpenAIStatus(error) }
    }).catch((loggingError) => {
      logger.error("OpenAI moderation centralized logging failed", {
        error:
          loggingError instanceof Error
            ? loggingError.message
            : "Unknown centralized logging failure"
      });
    });
    throw new Error(normalizeFailureMessage("OpenAI moderation", error));
  });
  const result = moderation.results[0];

  if (!result) {
    throw new Error("Prompt moderation did not return a result.");
  }

  return {
    flagged: result.flagged,
    categories: result.categories,
    categoryScores: result.category_scores
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
        organizationConfigured: Boolean(env.OPENAI_ORGANIZATION)
      });
      const {
        data,
        response,
        request_id: requestId
      } = await openai.images.generate(request).withResponse();
      const responseSummary = summarizeImagesResponse(data);
      logger.info("OpenAI image generation raw response", {
        model,
        status: response.status,
        requestId,
        responseSummary
      });
      return {
        data,
        status: response.status,
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

    logger.error("OpenAI image generation request failed", {
      model,
      size,
      quality,
      status,
      error: message,
      diagnostics
    });

    await logCentralizedError(error, {
      category: "openai",
      provider: "openai",
      message,
      severity: "critical",
      context: { model, size, quality, status, diagnostics }
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
    throw new Error(message);
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
  const summary = summarizeImagesResponse(image);

  if (!image || !Array.isArray(image.data) || !image.data[0]) {
    logger.error("OpenAI image response parsing failed: empty data", {
      ...logContext,
      responseSummary: summary
    });
    throw new Error("OpenAI returned an empty image response.");
  }

  const firstImage = image.data[0];
  const base64Image = firstImage.b64_json;

  if (typeof base64Image === "string" && base64Image.trim().length > 0) {
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

    return {
      base64,
      source: "url",
      sourceUrl: firstImage.url,
      contentType,
      revisedPrompt: firstImage.revised_prompt ?? null
    };
  }

  logger.error("OpenAI image response parsing failed: no usable payload", {
    ...logContext,
    responseSummary: summary
  });
  throw new Error("OpenAI did not return a valid image payload.");
}

export async function getGeneratedImageBase64(image: ImagesResponse) {
  return (await extractGeneratedImagePayload(image)).base64;
}
