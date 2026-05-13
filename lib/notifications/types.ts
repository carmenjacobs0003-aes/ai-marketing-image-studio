export type NotificationKind =
  | "welcome"
  | "tutorial"
  | "upgrade"
  | "usage_warning"
  | "saved_generation"
  | "creator_activity"
  | "gallery_interaction"
  | "profile_completion"
  | "achievement"
  | "weekly_digest"
  | "system";

export type NotificationTone = "info" | "success" | "warning" | "error";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  tone: NotificationTone;
  title: string;
  body: string;
  href?: string;
  createdAt: string;
  expiresAt?: string | null;
  read: boolean;
  realtime?: boolean;
};

export type NotificationPreferences = {
  inApp: boolean;
  email: boolean;
  weeklyDigest: boolean;
  creatorActivity: boolean;
  galleryInteractions: boolean;
  usageWarnings: boolean;
  productUpdates: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  inApp: true,
  email: false,
  weeklyDigest: true,
  creatorActivity: true,
  galleryInteractions: true,
  usageWarnings: true,
  productUpdates: false
};

export type EmailNotificationJob = {
  userId: string;
  to: string;
  subject: string;
  template:
    | "welcome"
    | "usage-warning"
    | "weekly-digest"
    | "creator-activity"
    | "gallery-interaction";
  payload: Record<string, unknown>;
  scheduledFor?: string;
};
