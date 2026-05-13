export type OnboardingStepId =
  | "welcome"
  | "profile"
  | "brand"
  | "generate"
  | "publish";

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  body: string;
  href: string;
};

export const onboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Open your workspace",
    body: "Learn where brand kits, generators, templates, and billing live.",
    href: "/dashboard"
  },
  {
    id: "profile",
    title: "Complete your profile",
    body: "Add your name and notification preferences.",
    href: "/settings"
  },
  {
    id: "brand",
    title: "Create a brand system",
    body: "Save voice, colors, fonts, product notes, and default creative constraints.",
    href: "/brand"
  },
  {
    id: "generate",
    title: "Generate your first asset",
    body: "Use Studio or Marketing to generate your first finished asset.",
    href: "/studio"
  },
  {
    id: "publish",
    title: "Publish to the gallery",
    body: "Publish a reusable prompt for community discovery.",
    href: "/gallery"
  }
];

export function getOnboardingProgress(completed: OnboardingStepId[]) {
  const uniqueCompleted = new Set(completed);
  const completedCount = onboardingSteps.filter((step) =>
    uniqueCompleted.has(step.id)
  ).length;
  const percent = Math.round((completedCount / onboardingSteps.length) * 100);

  return { completedCount, total: onboardingSteps.length, percent };
}
