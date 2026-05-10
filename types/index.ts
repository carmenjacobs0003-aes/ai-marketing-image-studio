export type ImageGenerationStatus = "queued" | "processing" | "completed" | "failed";

export interface StudioProject {
  id: string;
  name: string;
  createdAt: string;
}
