import type {
  ImagesResponse,
  ImageGenerateParams
} from "openai/resources/images";
import { env } from "@/lib/env";
import { createOpenAIClient } from "@/lib/openai/client";
import { normalizeFailureMessage, withRetry } from "@/lib/resilience";
import { logCentralizedError } from "@/lib/monitoring/errors";
import { logger } from "@/lib/logger";

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
        responseFormat: request.response_format ?? "model-default"
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
    const status = getOpenAIStatus(error);
    const message = normalizeFailureMessage("OpenAI image generation", error);

    logger.error("OpenAI image generation request failed", {
      model,
      size,
      quality,
      status,
      error: message
    });

    await logCentralizedError(error, {
      category: "openai",
      provider: "openai",
      message,
      severity: "critical",
      context: { model, size, quality, status }
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

export function getGeneratedImageBase64(image: ImagesResponse) {
  if (!image || !Array.isArray(image.data) || !image.data[0]) {
    throw new Error("OpenAI returned an empty image response.");
  }

  const base64Image = image.data[0].b64_json;

  if (typeof base64Image !== "string" || base64Image.trim().length === 0) {
    throw new Error("OpenAI did not return a valid base64 image payload.");
  }

  return base64Image;
}
