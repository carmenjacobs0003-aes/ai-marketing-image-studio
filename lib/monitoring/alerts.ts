import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

type AlertSeverity = "warning" | "critical";

type CriticalAlert = {
  title: string;
  message: string;
  severity?: AlertSeverity;
  context?: Record<string, unknown>;
};

const recentAlerts = new Map<string, number>();

function shouldSendAlert(key: string) {
  const now = Date.now();
  const previous = recentAlerts.get(key) ?? 0;

  if (now - previous < env.CRITICAL_ALERT_COOLDOWN_SECONDS * 1000) {
    return false;
  }

  recentAlerts.set(key, now);
  return true;
}

export async function sendCriticalAlert(alert: CriticalAlert) {
  const severity = alert.severity ?? "critical";
  const key = `${severity}:${alert.title}`;

  if (!shouldSendAlert(key)) {
    return { sent: false, reason: "cooldown" as const };
  }

  logger.error("Critical alert", {
    severity,
    title: alert.title,
    message: alert.message,
    ...alert.context
  });

  if (!env.CRITICAL_ALERT_WEBHOOK_URL) {
    return { sent: false, reason: "not_configured" as const };
  }

  const response = await fetch(env.CRITICAL_ALERT_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service: "Syntrix AI Marketing Image Studio",
      severity,
      title: alert.title,
      message: alert.message,
      context: alert.context ?? {},
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    logger.warn("Critical alert webhook failed", {
      status: response.status,
      title: alert.title
    });
    return { sent: false, reason: "webhook_failed" as const };
  }

  return { sent: true as const };
}
