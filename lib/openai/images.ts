import { env } from "@/lib/env";
import { createOpenAIClient } from "@/lib/openai/client";

export async function createMarketingImage(prompt: string) {
  const openai = createOpenAIClient();

  return openai.images.generate({
    model: env.OPENAI_IMAGE_MODEL,
    prompt,
    size: "1024x1024"
  });
}
