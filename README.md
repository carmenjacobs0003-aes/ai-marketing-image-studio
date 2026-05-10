# ai-marketing-image-studio

AI Marketing & Image Content Studio SaaS built with Next.js, Supabase, OpenAI, Upstash Redis, PayPal, and Sentry.

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

If Upstash Redis is configured, rate limiting uses Redis. Otherwise, local development falls back to an in-memory limiter:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Protected routes

Middleware refreshes Supabase sessions and protects `/dashboard`, `/projects`, and `/studio`. Authenticated users are redirected away from `/login` and `/signup` to `/dashboard`.

## Image generation flow

`POST /api/images/generate` expects JSON:

```json
{
  "prompt": "A campaign-ready lifestyle product image...",
  "projectId": "optional-project-uuid"
}
```

The route verifies authentication, applies the per-user rate limit, checks monthly usage entitlements, creates an `image_generations` row, calls OpenAI Images, uploads the generated image to Supabase Storage, records usage, and returns a signed image URL.
