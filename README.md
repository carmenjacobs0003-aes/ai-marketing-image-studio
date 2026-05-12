# syntrix-ai

SYNTRIX AI creative intelligence platform built with Next.js, Supabase, OpenAI, Upstash Redis, PayPal, and Sentry.

## Environment setup

Copy `.env.example` to `.env.local` and provide values for the services you enable.

### Supabase

Required for auth, database persistence, storage, usage tracking, and protected routes:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Apply the SQL migrations in `supabase/migrations` to create:

- User profiles synced from Supabase Auth.
- Projects, image generation records, and monthly usage events.
- Row Level Security policies scoped to `auth.uid()`.
- A private `generated-images` storage bucket with per-user object policies.

### OpenAI

Required for `/api/images/generate`:

- `OPENAI_API_KEY`
- `OPENAI_IMAGE_MODEL` (defaults to `gpt-image-1`)

### Rate limiting

Image generation is rate limited per user. Configure:

- `IMAGE_GENERATION_RATE_LIMIT` (defaults to `10`)
- `IMAGE_GENERATION_RATE_LIMIT_WINDOW_SECONDS` (defaults to `3600`)

If Upstash Redis is configured, rate limiting uses Redis. Otherwise, local development falls back to an in-memory limiter. Production should use the canonical Upstash REST variables connected in Vercel Project Settings → Environment Variables:

- `UPSTASH_REDIS_REST_URL` (or Vercel KV alias `KV_REST_API_URL`)
- `UPSTASH_REDIS_REST_TOKEN` (or Vercel KV alias `KV_REST_API_TOKEN`)

Vercel KV marketplace integrations that expose `KV_REST_API_URL` and `KV_REST_API_TOKEN` are also accepted as compatibility aliases, but direct Upstash Redis deployments should use the canonical `UPSTASH_*` names.

## Protected routes

Middleware refreshes Supabase SSR sessions and protects `/dashboard`, `/marketing`, `/images`, `/projects`, `/brand`, `/templates`, `/billing`, `/settings`, `/admin`, and `/studio`. Unauthenticated users are redirected to `/login` with a safe `redirectTo` value, while authenticated users are redirected away from `/login` and `/signup` to `/dashboard`.

## Image generation flow

`POST /api/images/generate` expects JSON:

```json
{
  "prompt": "A campaign-ready lifestyle product image...",
  "projectId": "optional-project-uuid"
}
```

The route verifies authentication, applies the per-user rate limit, checks monthly usage entitlements, creates an `image_generations` row, calls OpenAI Images, uploads the generated image to Supabase Storage, records usage, and returns a signed image URL.

## Production deployment

This app is configured for Vercel with `vercel.json`, production function timeouts, a `/healthz` rewrite, security headers, Sentry upload settings, optimized image formats, and immutable icon caching.

### Required production environment variables

Production readiness validation in `lib/env.ts` checks these variables when `NODE_ENV=production` or `VERCEL_ENV=production`:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `UPSTASH_REDIS_REST_URL` (or Vercel KV alias `KV_REST_API_URL`)
- `UPSTASH_REDIS_REST_TOKEN` (or Vercel KV alias `KV_REST_API_TOKEN`)
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_DSN`

Set `NEXT_PUBLIC_APP_URL` to the canonical custom domain, for example `https://studio.example.com`. Add the same domain in Vercel Project Settings → Domains and configure DNS as instructed by Vercel. `NEXT_PUBLIC_SITE_DOMAIN` is available for display or operational metadata.

### Monitoring, logging, and diagnostics

- Sentry is initialized with release, environment, trace, and profile sampling.
- Structured JSON logs are emitted for image and marketing generation success/failure.
- `/api/health` and `/healthz` return deployment diagnostics for uptime checks.
- Mutating API requests receive a shared IP/path rate limit in middleware, with per-user image generation limits still enforced in the generation route.

## PWA and mobile app conversion

The app includes a manifest, service worker, offline fallback page, maskable icons, Apple web app metadata, install shortcuts, robots.txt, sitemap.xml, privacy policy, and terms pages.

### Capacitor packaging

Capacitor is configured in `capacitor.config.json` for Android and iOS shells pointed at the production web deployment.

Recommended commands after installing dependencies in an environment that can access the npm registry:

```bash
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

Before publishing native builds, generate platform-native icon and splash assets from `public/icons/icon.svg`, then run `npx cap add android` and `npx cap add ios` if the native folders have not been created yet.

## Production monitoring and recovery

See [`docs/monitoring-recovery.md`](docs/monitoring-recovery.md) for health checks, alerting, abuse prevention, generation recovery, and database backup guidance.
