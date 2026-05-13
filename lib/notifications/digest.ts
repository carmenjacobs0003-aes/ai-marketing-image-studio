import { BRAND_NAME } from "@/lib/branding";
import type {
  AppNotification,
  EmailNotificationJob
} from "@/lib/notifications/types";

export type WeeklyDigestInput = {
  userId: string;
  email: string;
  generatedImages: number;
  generatedMarketingAssets: number;
  savedAssets: number;
  galleryLikes: number;
  newBadges: string[];
  notifications: AppNotification[];
};

export function buildWeeklyDigest(
  input: WeeklyDigestInput
): EmailNotificationJob {
  const highlights = input.notifications
    .filter((notification) =>
      ["achievement", "gallery_interaction", "creator_activity"].includes(
        notification.kind
      )
    )
    .slice(0, 5)
    .map((notification) => ({
      title: notification.title,
      body: notification.body
    }));

  return {
    userId: input.userId,
    to: input.email,
    subject: `Your ${BRAND_NAME} weekly creative signal`,
    template: "weekly-digest",
    payload: {
      generatedImages: input.generatedImages,
      generatedMarketingAssets: input.generatedMarketingAssets,
      savedAssets: input.savedAssets,
      galleryLikes: input.galleryLikes,
      newBadges: input.newBadges,
      highlights
    }
  };
}
