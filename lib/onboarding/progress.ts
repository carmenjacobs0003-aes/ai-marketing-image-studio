export type OnboardingStepId =
  | "welcome"
  | "profile"
  | "brand"
  | "project"
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
    title: "Enter the command deck",
    body: "Tour your neon workspace and learn where projects, brand kits, and generators live.",
    href: "/dashboard"
  },
  {
    id: "profile",
    title: "Complete your creator profile",
    body: "Add a name and notification preferences so SYNTRIX AI can personalize guidance.",
    href: "/settings"
  },
  {
    id: "brand",
    title: "Create a brand system",
    body: "Save voice, colors, fonts, product notes, and default creative constraints.",
    href: "/brand"
  },
  {
    id: "project",
    title: "Launch your first project",
    body: "Create a reusable campaign workspace that connects copy, visuals, and saves.",
    href: "/projects"
  },
  {
    id: "generate",
    title: "Generate your first asset",
    body: "Use Studio or Marketing to produce a campaign-ready output.",
    href: "/studio"
  },
  {
    id: "publish",
    title: "Share with the gallery",
    body: "Publish a reusable prompt and start earning creator activity signals.",
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
