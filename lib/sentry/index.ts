import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

export function registerSentry() {
  Sentry.init({
    dsn: env.SENTRY_DSN ?? env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1.0
  });
}
