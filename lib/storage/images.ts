import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const GENERATED_IMAGES_BUCKET = "generated-images";

export async function uploadGeneratedImage(userId: string, generationId: string, base64Image: string) {
  const supabase = createSupabaseAdminClient();
  const storagePath = `${userId}/${generationId}.png`;
  const imageBuffer = Buffer.from(base64Image, "base64");

  const { error } = await supabase.storage.from(GENERATED_IMAGES_BUCKET).upload(storagePath, imageBuffer, {
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
  const { data, error } = await supabase.storage.from(GENERATED_IMAGES_BUCKET).createSignedUrl(storagePath, 60 * 60);

  if (error) {
    throw new Error(error.message);
  }

  return data.signedUrl;
}
