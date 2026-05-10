import { z } from "zod";

export const marketingContentTypeSchema = z.enum([
  "complete_marketing_pack",
  "social_media_posts",
  "email_outreach",
  "seo_blog_content"
]);

export type MarketingContentType = z.infer<typeof marketingContentTypeSchema>;

export const marketingOutputSchema = z.object({
  campaignSummary: z.string().min(1),
  socialMediaPosts: z
    .array(
      z.object({
        platform: z.string().min(1),
        post: z.string().min(1),
        callToAction: z.string().min(1),
        hashtags: z.array(z.string()).default([])
      })
    )
    .min(3),
  emailOutreach: z.object({
    subjectLines: z.array(z.string().min(1)).min(3),
    previewText: z.string().min(1),
    body: z.string().min(1),
    callToAction: z.string().min(1),
    followUp: z.string().min(1)
  }),
  seoBlogContent: z.object({
    title: z.string().min(1),
    metaDescription: z.string().min(1),
    slug: z.string().min(1),
    keywords: z.array(z.string().min(1)).min(3),
    outline: z.array(z.string().min(1)).min(4),
    intro: z.string().min(1),
    callToAction: z.string().min(1)
  })
});

export type MarketingOutput = z.infer<typeof marketingOutputSchema>;
