import type { ImagesResponse } from "openai/resources/images";
import { env } from "@/lib/env";
import { createOpenAIClient } from "@/lib/openai/client";
import { normalizeFailureMessage, withRetry } from "@/lib/resilience";
import { logCentralizedError } from "@/lib/monitoring/errors";

export type ImageGenerationSize = "1024x1024" | "1024x1792" | "1792x1024";
export type ImageGenerationQuality = "standard" | "hd";

export type GenerateMarketingImageInput = {
  prompt: string;
  size?: ImageGenerationSize;
  quality?: ImageGenerationQuality;
};

const DALL_E_MODELS = new Set(["dall-e-2", "dall-e-3"]);
const QUALITY_MODELS = new Set(["dall-e-3"]);

export async function moderateImagePrompt(prompt: string) {
  const openai = createOpenAIClient();
  const moderation = await withRetry(
    () =>
      openai.moderations.create({
        model: "omni-moderation-latest",
        input: prompt
      }),
    { label: "openai.image_moderation" }
  ).catch(async (error) => {
    await logCentralizedError(error, {
      category: "openai",
      provider: "openai",
      message: normalizeFailureMessage("OpenAI moderation", error),
      severity: "critical"
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
  quality = "standard"
}: GenerateMarketingImageInput): Promise<ImagesResponse> {
  const openai = createOpenAIClient();
  const model = env.OPENAI_IMAGE_MODEL;
  const request = {
    model,
    prompt,
    n: 1,
    size,
    ...(DALL_E_MODELS.has(model)
      ? { response_format: "b64_json" as const }
      : {}),
    ...(QUALITY_MODELS.has(model) ? { quality } : {})
  };

  return withRetry(() => openai.images.generate(request), {
    label: "openai.image_generation"
  }).catch(async (error) => {
    await logCentralizedError(error, {
      category: "openai",
      provider: "openai",
      message: normalizeFailureMessage("OpenAI image generation", error),
      severity: "critical",
      context: { model, size, quality }
    });
    throw new Error(normalizeFailureMessage("OpenAI image generation", error));
  });
}

export function getGeneratedImageBase64(image: ImagesResponse) {
  const base64Image = image.data?.[0]?.b64_json;

  if (!base64Image) {
    throw new Error("OpenAI did not return an image payload.");
  }

  return base64Image;
}
