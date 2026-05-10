import { env } from "@/lib/env";
import { createOpenAIClient } from "@/lib/openai/client";

type MarketingCopyInput = {
  prompt: string;
  contentType: string;
  brandVoice?: string | null;
  guidelines?: string | null;
};

export const MARKETING_TEXT_MODEL = "gpt-4o-mini";

export async function createMarketingCopy({
  prompt,
  contentType,
  brandVoice,
  guidelines
}: MarketingCopyInput) {
  const openai = createOpenAIClient();
  const response = await openai.chat.completions.create({
    model: MARKETING_TEXT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a concise senior marketing strategist. Return practical campaign copy with a headline, body copy, call to action, and three platform-specific variations."
      },
      {
        role: "user",
        content: [
          `Content type: ${contentType}`,
          brandVoice ? `Brand voice: ${brandVoice}` : null,
          guidelines ? `Brand guidelines: ${guidelines}` : null,
          `Brief: ${prompt}`
        ]
          .filter(Boolean)
          .join("\n")
      }
    ],
    temperature: 0.7
  });

  return {
    model: MARKETING_TEXT_MODEL,
    text: response.choices[0]?.message.content?.trim() ?? "",
    raw: response
  };
}

export function getMarketingModelName() {
  return env.OPENAI_API_KEY ? MARKETING_TEXT_MODEL : MARKETING_TEXT_MODEL;
}
