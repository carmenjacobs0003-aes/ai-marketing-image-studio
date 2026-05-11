import { z } from "zod";

const baseEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("AI Marketing Image Studio"),
  NEXT_PUBLIC_APP_DESCRIPTION: z
    .string()
    .default("Create campaign-ready marketing images and copy with AI."),
  NEXT_PUBLIC_SITE_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_TEXT_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_IMAGE_MODEL: z.string().default("dall-e-3"),
  API_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(60),
  IMAGE_GENERATION_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  IMAGE_GENERATION_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(3600),
  PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),
  PAYPAL_PRO_PLAN_ID: z.string().optional(),
  PAYPAL_AGENCY_PLAN_ID: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  SENTRY_PROFILES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1)
});

const productionRequiredKeys = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_DSN"
] as const;

export const envSchema = baseEnvSchema.superRefine((values, context) => {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";

  if (!isProduction) {
    return;
  }

  for (const key of productionRequiredKeys) {
    if (!values[key]) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${key} is required for production deployments.`,
        path: [key]
      });
    }
  }

  if (values.PAYPAL_ENV === "live") {
    for (const key of [
      "PAYPAL_CLIENT_ID",
      "PAYPAL_CLIENT_SECRET",
      "NEXT_PUBLIC_PAYPAL_CLIENT_ID",
      "PAYPAL_WEBHOOK_ID"
    ] as const) {
      if (!values[key]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} is required when PAYPAL_ENV=live.`,
          path: [key]
        });
      }
    }
  }
});

export const env = envSchema.parse(process.env);
