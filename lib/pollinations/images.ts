import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { normalizeFailureMessage, withRetry } from "@/lib/resilience";
import { logCentralizedError } from "@/lib/monitoring/errors";

export const POLLINATIONS_IMAGE_ENDPOINT = "https://gen.pollinations.ai/image";
export const DEFAULT_POLLINATIONS_IMAGE_MODEL = "flux";

export type PollinationsImageSize = {
  width: number;
  height: number;
};

export type GeneratePollinationsImageInput = PollinationsImageSize & {
  prompt: string;
  model?: string;
  seed?: number;
};

export type PollinationsImageResult = {
  base64: string;
  status: number;
  statusText: string;
  ok: boolean;
  contentType: string | null;
  model: string;
  seed?: number;
  width: number;
  height: number;
  endpoint: string;
};

export class PollinationsImageGenerationError extends Error {
  readonly status?: number;
  readonly statusText?: string;

  constructor(message: string, status?: number, statusText?: string) {
    super(message);
    this.name = "PollinationsImageGenerationError";
    this.status = status;
    this.statusText = statusText;
  }
}

export function normalizePollinationsModel(model?: string) {
  const normalized = model?.trim();
  return normalized || DEFAULT_POLLINATIONS_IMAGE_MODEL;
}

export function getPollinationsImageUrl({
  prompt,
  model,
  width,
  height,
  seed
}: GeneratePollinationsImageInput) {
  const url = new URL(
    `${POLLINATIONS_IMAGE_ENDPOINT}/${encodeURIComponent(prompt)}`
  );
  url.searchParams.set("model", normalizePollinationsModel(model));
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));

  if (typeof seed === "number" && Number.isFinite(seed)) {
    url.searchParams.set("seed", String(seed));
  }

  return url;
}

export async function createPollinationsImage({
  prompt,
  model,
  width,
  height,
  seed
}: GeneratePollinationsImageInput): Promise<PollinationsImageResult> {
  const normalizedModel = normalizePollinationsModel(model);
  const url = getPollinationsImageUrl({
    prompt,
    model: normalizedModel,
    width,
    height,
    seed
  });

  return withRetry(
    async () => {
      logger.info("Pollinations image generation request start", {
        model: normalizedModel,
        width,
        height,
        seed: seed ?? null,
        promptLength: prompt.length,
        endpoint: `${POLLINATIONS_IMAGE_ENDPOINT}/{prompt}`,
        hasApiKey: Boolean(env.POLLINATIONS_API_KEY)
      });

      const response = await fetch(url, {
        headers: env.POLLINATIONS_API_KEY
          ? { Authorization: `Bearer ${env.POLLINATIONS_API_KEY}` }
          : undefined
      });
      const contentType = response.headers.get("content-type");

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new PollinationsImageGenerationError(
          `Pollinations image generation failed (${response.status} ${response.statusText})${
            errorText ? `: ${errorText.slice(0, 500)}` : ""
          }`,
          response.status,
          response.statusText
        );
      }

      if (contentType && !contentType.startsWith("image/")) {
        const responseText = await response.text().catch(() => "");
        throw new PollinationsImageGenerationError(
          `Pollinations returned a non-image response${
            responseText ? `: ${responseText.slice(0, 500)}` : "."
          }`,
          response.status,
          response.statusText
        );
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      if (buffer.length === 0) {
        throw new PollinationsImageGenerationError(
          "Pollinations returned an empty image payload.",
          response.status,
          response.statusText
        );
      }

      logger.info("Pollinations image generation response received", {
        model: normalizedModel,
        width,
        height,
        seed: seed ?? null,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        contentType,
        byteLength: buffer.length
      });

      return {
        base64: buffer.toString("base64"),
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        contentType,
        model: normalizedModel,
        seed,
        width,
        height,
        endpoint: `${POLLINATIONS_IMAGE_ENDPOINT}/{prompt}`
      };
    },
    { label: "pollinations.image_generation" }
  ).catch(async (error) => {
    const message = normalizeFailureMessage(
      "Pollinations image generation",
      error
    );
    const status =
      error instanceof PollinationsImageGenerationError
        ? error.status
        : undefined;

    logger.error("Pollinations image generation request failed", {
      model: normalizedModel,
      width,
      height,
      seed: seed ?? null,
      status,
      error: error instanceof Error ? error.message : String(error),
      normalizedMessage: message,
      stack: error instanceof Error ? error.stack : null
    });

    await logCentralizedError(error, {
      category: "generation",
      provider: "pollinations",
      message,
      severity: "critical",
      context: {
        model: normalizedModel,
        width,
        height,
        seed: seed ?? null,
        status
      }
    }).catch((loggingError) => {
      logger.error("Pollinations image generation centralized logging failed", {
        model: normalizedModel,
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
