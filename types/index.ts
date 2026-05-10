import type { AppPlan, DailyUsageKind, GenerationStatus } from "@/lib/db/types";

export type ImageGenerationStatus = GenerationStatus;
export type MarketingGenerationStatus = GenerationStatus;
export type Plan = AppPlan;
export type UsageKind = DailyUsageKind;

export interface StudioProject {
  id: string;
  name: string;
  createdAt: string;
}
