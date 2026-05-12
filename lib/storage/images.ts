import type { ImageGeneration } from "@/lib/db/queries";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export const GENERATED_IMAGES_BUCKET = "generated-images";
export const GENERATED_IMAGE_SIGNED_URL_SECONDS = 60 * 60;

export type ImageWithSignedUrl<T extends { storage_path: string | null }> =
  T & {
    signedUrl: string | null;
    downloadUrl: string | null;
  };

export function getGeneratedImageStoragePath(
  userId: string,
  generationId: string
) {
  return `${userId}/${generationId}.png`;
}

export function decodeGeneratedImage(base64Image: string) {
  return Buffer.from(base64Image, "base64");
}

export async function uploadGeneratedImage(
  userId: string,
  generationId: string,
  base64Image: string
) {
  const supabase = createSupabaseAdminClient();
  const storagePath = getGeneratedImageStoragePath(userId, generationId);
  const imageBuffer = decodeGeneratedImage(base64Image);

  logger.info("Supabase storage upload request start", {
    bucket: GENERATED_IMAGES_BUCKET,
    storagePath,
    byteLength: imageBuffer.length,
    userId,
    generationId
  });

  const { error } = await supabase.storage
    .from(GENERATED_IMAGES_BUCKET)
    .upload(storagePath, imageBuffer, {
      contentType: "image/png",
      upsert: true
    });

  if (error) {
    logger.error("Supabase storage upload request failed", {
      bucket: GENERATED_IMAGES_BUCKET,
      storagePath,
      userId,
      generationId,
      error: error.message
    });
    throw new Error(`Supabase storage upload failed: ${error.message}`);
  }

  logger.info("Supabase storage upload request completed", {
    bucket: GENERATED_IMAGES_BUCKET,
    storagePath,
    userId,
    generationId
  });

  return storagePath;
}

export async function createSignedImageUrl(storagePath: string) {
  const supabase = createSupabaseAdminClient();
  logger.info("Supabase signed image URL request start", {
    bucket: GENERATED_IMAGES_BUCKET,
    storagePath,
    expiresInSeconds: GENERATED_IMAGE_SIGNED_URL_SECONDS
  });
  const { data, error } = await supabase.storage
    .from(GENERATED_IMAGES_BUCKET)
    .createSignedUrl(storagePath, GENERATED_IMAGE_SIGNED_URL_SECONDS, {
      download: false
    });

  if (error) {
    logger.error("Supabase signed image URL request failed", {
      bucket: GENERATED_IMAGES_BUCKET,
      storagePath,
      error: error.message
    });
    throw new Error(`Supabase signed image URL failed: ${error.message}`);
  }

  if (!data?.signedUrl) {
    logger.error("Supabase signed image URL response missing signedUrl", {
      bucket: GENERATED_IMAGES_BUCKET,
      storagePath
    });
    throw new Error("Supabase signed image URL failed: missing signedUrl");
  }

  logger.info("Supabase signed image URL request completed", {
    bucket: GENERATED_IMAGES_BUCKET,
    storagePath,
    hasSignedUrl: true
  });

  return data.signedUrl;
}

export async function createSignedDownloadUrl(storagePath: string) {
  const supabase = createSupabaseAdminClient();
  logger.info("Supabase signed download URL request start", {
    bucket: GENERATED_IMAGES_BUCKET,
    storagePath,
    expiresInSeconds: GENERATED_IMAGE_SIGNED_URL_SECONDS
  });
  const { data, error } = await supabase.storage
    .from(GENERATED_IMAGES_BUCKET)
    .createSignedUrl(storagePath, GENERATED_IMAGE_SIGNED_URL_SECONDS, {
      download: true
    });

  if (error) {
    logger.error("Supabase signed download URL request failed", {
      bucket: GENERATED_IMAGES_BUCKET,
      storagePath,
      error: error.message
    });
    throw new Error(`Supabase signed download URL failed: ${error.message}`);
  }

  if (!data?.signedUrl) {
    logger.error("Supabase signed download URL response missing signedUrl", {
      bucket: GENERATED_IMAGES_BUCKET,
      storagePath
    });
    throw new Error("Supabase signed download URL failed: missing signedUrl");
  }

  logger.info("Supabase signed download URL request completed", {
    bucket: GENERATED_IMAGES_BUCKET,
    storagePath,
    hasSignedUrl: true
  });

  return data.signedUrl;
}

export async function withSignedImageUrls<T extends ImageGeneration>(
  images: T[]
): Promise<Array<ImageWithSignedUrl<T>>> {
  return Promise.all(
    images.map(async (image) => {
      const [signedUrl, downloadUrl] = image.storage_path
        ? await Promise.all([
            createSignedImageUrl(image.storage_path).catch(() => null),
            createSignedDownloadUrl(image.storage_path).catch(() => null)
          ])
        : [null, null];

      return {
        ...image,
        signedUrl,
        downloadUrl
      };
    })
  );
}
