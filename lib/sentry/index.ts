import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

export function registerSentry() {
  Sentry.init({
    dsn: env.SENTRY_DSN ?? env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    profilesSampleRate: env.SENTRY_PROFILES_SAMPLE_RATE,
    beforeSend(event) {
      if (event.request?.cookies) {
        delete event.request.cookies;
      }

      return event;
    }
  });
}
