import type { BrandKit } from "@/lib/db/queries";

export function buildBrandPromptContext(brandKit: BrandKit | null | undefined) {
  if (!brandKit) {
    return null;
  }

  const parts = [
    `Brand name: ${brandKit.name}`,
    brandKit.tone ? `Tone: ${brandKit.tone}` : null,
    brandKit.voice ? `Voice: ${brandKit.voice}` : null,
    brandKit.colors.length ? `Colours: ${brandKit.colors.join(", ")}` : null,
    brandKit.fonts.length ? `Fonts: ${brandKit.fonts.join(", ")}` : null,
    brandKit.logo_url ? `Logo reference: ${brandKit.logo_url}` : null,
    brandKit.guidelines ? `Guidelines: ${brandKit.guidelines}` : null
  ].filter(Boolean);

  return parts.length ? parts.join("\n") : null;
}

export function injectBrandIntoImagePrompt(
  prompt: string,
  brandKit: BrandKit | null | undefined
) {
  const brandContext = buildBrandPromptContext(brandKit);

  if (!brandContext) {
    return prompt;
  }

  return [
    prompt,
    "Apply this saved brand kit faithfully while preserving the user's core concept:",
    brandContext
  ].join("\n\n");
}
