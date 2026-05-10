import { env } from "@/lib/env";
import { openai } from "@/lib/openai/client";

export async function createMarketingImage(prompt: string) {
  return openai.images.generate({
    model: env.OPENAI_IMAGE_MODEL,
    prompt
  });
}
