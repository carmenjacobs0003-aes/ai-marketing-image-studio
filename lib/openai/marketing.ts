import { env } from "@/lib/env";
import { createOpenAIClient } from "@/lib/openai/client";
import {
  marketingOutputSchema,
  type MarketingContentType,
  type MarketingOutput
} from "@/types/marketing";

export const MARKETING_TEXT_MODEL = env.OPENAI_TEXT_MODEL;
export const MARKETING_MODERATION_MODEL = "omni-moderation-latest";

export type MarketingCopyInput = {
  prompt: string;
  contentType: MarketingContentType;
  brandContext?: string | null;
  templateInstruction?: string | null;
};

export type MarketingModerationResult = {
  flagged: boolean;
  categories: string[];
  moderationId: string;
  model: string;
};

function getContentTypeInstruction(contentType: MarketingContentType) {
  switch (contentType) {
    case "social_media_posts":
      return "Prioritize the social media section while still returning email outreach and SEO blog content.";
    case "email_outreach":
      return "Prioritize the email outreach section while still returning social media posts and SEO blog content.";
    case "seo_blog_content":
      return "Prioritize the SEO blog section while still returning social media posts and email outreach.";
    case "complete_marketing_pack":
    default:
      return "Create a balanced marketing pack across social, email, and SEO blog content.";
  }
}

function getFlaggedCategories(categories: Record<string, boolean | null>) {
  return Object.entries(categories)
    .filter(([, flagged]) => Boolean(flagged))
    .map(([category]) => category);
}

function parseMarketingOutput(content: string): MarketingOutput {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI returned invalid marketing JSON.");
  }

  const result = marketingOutputSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error("OpenAI returned incomplete marketing content.");
  }

  return result.data;
}

export async function moderateMarketingInput(
  prompt: string
): Promise<MarketingModerationResult> {
  const openai = createOpenAIClient();
  const response = await openai.moderations.create({
    model: MARKETING_MODERATION_MODEL,
    input: prompt
  });
  const result = response.results[0];

  if (!result) {
    throw new Error("OpenAI moderation did not return a result.");
  }

  return {
    flagged: result.flagged,
    categories: getFlaggedCategories({ ...result.categories }),
    moderationId: response.id,
    model: response.model
  };
}

export async function createMarketingCopy({
  prompt,
  contentType,
  brandContext,
  templateInstruction
}: MarketingCopyInput) {
  const openai = createOpenAIClient();
  const response = await openai.chat.completions.create({
    model: MARKETING_TEXT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a senior lifecycle, social, and SEO marketing strategist. Return only valid JSON that matches the requested schema. Keep copy practical, specific, conversion-focused, safe, and ready to publish. Do not include markdown fences."
      },
      {
        role: "user",
        content: [
          `Requested focus: ${contentType}`,
          getContentTypeInstruction(contentType),
          "Return JSON with campaignSummary, socialMediaPosts, emailOutreach, and seoBlogContent.",
          "socialMediaPosts must include at least LinkedIn, X, and Instagram variants with platform, post, callToAction, and hashtags.",
          "emailOutreach must include subjectLines, previewText, body, callToAction, and followUp.",
          "seoBlogContent must include title, metaDescription, slug, keywords, outline, intro, and callToAction.",
          templateInstruction
            ? `Reusable template instructions: ${templateInstruction}`
            : null,
          brandContext
            ? `Saved brand kit context:
${brandContext}`
            : null,
          `Brief: ${prompt}`
        ]
          .filter(Boolean)
          .join("\n")
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7
  });
  const text = response.choices[0]?.message.content?.trim() ?? "";

  if (!text) {
    throw new Error("OpenAI did not return marketing content.");
  }

  return {
    model: MARKETING_TEXT_MODEL,
    output: parseMarketingOutput(text),
    raw: response
  };
}

export function getMarketingModelName() {
  return MARKETING_TEXT_MODEL;
}
