import type { ImageGeneration } from "@/lib/db/queries";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

  const { error } = await supabase.storage
    .from(GENERATED_IMAGES_BUCKET)
    .upload(storagePath, imageBuffer, {
      contentType: "image/png",
      upsert: true
    });

  if (error) {
    throw new Error(error.message);
  }

  return storagePath;
}

export async function createSignedImageUrl(storagePath: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(GENERATED_IMAGES_BUCKET)
    .createSignedUrl(storagePath, GENERATED_IMAGE_SIGNED_URL_SECONDS, {
      download: false
    });

  if (error) {
    throw new Error(error.message);
  }

  return data.signedUrl;
}

export async function createSignedDownloadUrl(storagePath: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(GENERATED_IMAGES_BUCKET)
    .createSignedUrl(storagePath, GENERATED_IMAGE_SIGNED_URL_SECONDS, {
      download: true
    });

  if (error) {
    throw new Error(error.message);
  }

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
