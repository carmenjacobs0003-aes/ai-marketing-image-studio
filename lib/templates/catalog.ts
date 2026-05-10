import type { MarketingContentType } from "@/types/marketing";

export type TemplateCategory = "social" | "email" | "seo" | "industry";

export type MarketingTemplate = {
  id: string;
  category: TemplateCategory;
  name: string;
  description: string;
  contentType: MarketingContentType;
  prompt: string;
  channels: string[];
};

export const marketingTemplates: MarketingTemplate[] = [
  {
    id: "social-launch-sprint",
    category: "social",
    name: "Social launch sprint",
    description:
      "A high-velocity product launch set for LinkedIn, X, and Instagram.",
    contentType: "social_media_posts",
    channels: ["LinkedIn", "X", "Instagram"],
    prompt:
      "Create a punchy multi-platform launch sequence with teaser, launch-day, and proof-point angles. Include scroll-stopping hooks and strong CTA variants."
  },
  {
    id: "social-founder-led",
    category: "social",
    name: "Founder-led social",
    description:
      "Thought-leadership posts that turn a founder insight into demand.",
    contentType: "social_media_posts",
    channels: ["LinkedIn", "X"],
    prompt:
      "Write founder-led social content with a contrarian insight, a short story, practical takeaways, and comments-driving questions."
  },
  {
    id: "email-nurture-sequence",
    category: "email",
    name: "3-step nurture email",
    description: "Awareness-to-conversion sequence for leads or trial users.",
    contentType: "email_outreach",
    channels: ["Email"],
    prompt:
      "Build a nurture email that opens with the buyer pain, explains the product promise, adds proof, and closes with a low-friction CTA."
  },
  {
    id: "email-winback",
    category: "email",
    name: "Win-back email",
    description:
      "Re-engage dormant leads with urgency and a clear next action.",
    contentType: "email_outreach",
    channels: ["Email"],
    prompt:
      "Create a concise win-back email with empathy, a fresh reason to return, a time-sensitive benefit, and a follow-up message."
  },
  {
    id: "seo-comparison",
    category: "seo",
    name: "SEO comparison article",
    description: "Search-ready comparison content for high-intent buyers.",
    contentType: "seo_blog_content",
    channels: ["Blog", "Search"],
    prompt:
      "Plan a comparison article targeting high-intent searchers. Include differentiators, objection handling, keyword clusters, and a conversion CTA."
  },
  {
    id: "seo-how-to-guide",
    category: "seo",
    name: "SEO how-to guide",
    description: "Educational guide that captures problem-aware search demand.",
    contentType: "seo_blog_content",
    channels: ["Blog", "Search"],
    prompt:
      "Create a practical how-to article outline with expert tips, common mistakes, featured-snippet friendly sections, and a product-led CTA."
  },
  {
    id: "industry-saas",
    category: "industry",
    name: "B2B SaaS preset",
    description:
      "Pipeline-focused SaaS messaging for demos, trials, and expansion.",
    contentType: "complete_marketing_pack",
    channels: ["SaaS", "Demand gen"],
    prompt:
      "Use B2B SaaS positioning. Emphasize pipeline impact, onboarding speed, integrations, measurable ROI, and buyer objections from revenue teams."
  },
  {
    id: "industry-ecommerce",
    category: "industry",
    name: "Ecommerce preset",
    description:
      "Conversion-led ecommerce copy for launches and seasonal campaigns.",
    contentType: "complete_marketing_pack",
    channels: ["Ecommerce", "DTC"],
    prompt:
      "Use ecommerce positioning. Emphasize product benefits, urgency, customer reviews, bundles, sensory details, and mobile-first shopping CTAs."
  },
  {
    id: "industry-local-services",
    category: "industry",
    name: "Local services preset",
    description:
      "Trust-building local service campaign for bookings and calls.",
    contentType: "complete_marketing_pack",
    channels: ["Local", "Services"],
    prompt:
      "Use local services positioning. Emphasize service area, trust signals, fast response, guarantees, testimonials, and call/book-now CTAs."
  }
];

export function getMarketingTemplate(templateId?: string | null) {
  if (!templateId) {
    return null;
  }

  return (
    marketingTemplates.find((template) => template.id === templateId) ?? null
  );
}
