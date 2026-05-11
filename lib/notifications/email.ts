import type {
  EmailNotificationJob,
  NotificationPreferences
} from "@/lib/notifications/types";

export type EmailNotificationTransport = {
  enqueue(job: EmailNotificationJob): Promise<{ queued: true; id: string }>;
};

export const consoleEmailNotificationTransport: EmailNotificationTransport = {
  async enqueue(job) {
    const id = `email_${job.template}_${job.userId}_${Date.now()}`;

    if (process.env.NODE_ENV !== "production") {
      console.info("Queued email notification", {
        id,
        template: job.template,
        to: job.to
      });
    }

    return { queued: true, id };
  }
};

export function shouldSendEmailNotification(
  preferences: NotificationPreferences,
  category: keyof Pick<
    NotificationPreferences,
    | "weeklyDigest"
    | "creatorActivity"
    | "galleryInteractions"
    | "usageWarnings"
    | "productUpdates"
  >
) {
  return preferences.email && preferences[category];
}

export async function queueEmailNotification(
  job: EmailNotificationJob,
  transport: EmailNotificationTransport = consoleEmailNotificationTransport
) {
  return transport.enqueue(job);
}
