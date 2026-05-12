# Production launch runbook

This checklist is the final Vercel launch gate for SYNTRIX AI.

## Deployment checklist

1. **Vercel project**
   - Connect the production Git branch to Vercel.
   - Confirm the framework preset is `nextjs`, the build command is `npm run vercel:build`, and the output directory is `.next`.
   - Keep the production region in `iad1` unless Supabase, Redis, and PayPal are moved to another primary region.
2. **Required production environment variables**
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_APP_NAME`
   - `NEXT_PUBLIC_APP_DESCRIPTION`
   - `NEXT_PUBLIC_SITE_DOMAIN`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `OPENAI_TEXT_MODEL`
   - `OPENAI_IMAGE_MODEL`
   - `API_TIMEOUT_SECONDS`
   - `IMAGE_GENERATION_RATE_LIMIT`
   - `IMAGE_GENERATION_RATE_LIMIT_WINDOW_SECONDS`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `NEXT_PUBLIC_SENTRY_DSN`
   - `SENTRY_DSN`
   - `SENTRY_AUTH_TOKEN`
   - `SENTRY_ORG`
   - `SENTRY_PROJECT`
   - `SENTRY_TRACES_SAMPLE_RATE`
   - `SENTRY_PROFILES_SAMPLE_RATE`
3. **PayPal production variables**
   - Set `PAYPAL_ENV=live` for production checkout.
   - Configure `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_PRO_PLAN_ID`, and `PAYPAL_AGENCY_PLAN_ID`.
   - Configure the PayPal webhook URL as `https://<production-domain>/api/webhooks/paypal`.
4. **Supabase production integration**
   - Confirm Auth redirect URLs include `https://<production-domain>/login`, `https://<production-domain>/signup`, and `https://<production-domain>/dashboard`.
   - Confirm storage buckets and row-level security policies used by generated images, projects, brand kits, usage, profiles, and gallery tables are applied.
   - Rotate the service role key after launch if it has been shared outside Vercel.
5. **OpenAI production usage**
   - Confirm the OpenAI project has production billing and usage limits.
   - Confirm `OPENAI_TEXT_MODEL` and `OPENAI_IMAGE_MODEL` are approved for production traffic.
   - Monitor latency and error rates during the first image and marketing generation smoke tests.
6. **Health checks and monitoring**
   - `GET /healthz` returns liveness status and redacted configuration diagnostics.
   - `GET /readyz` returns `200` only when production-required integrations are configured.
   - Vercel cron pings `/api/health` every 15 minutes.
   - Confirm Sentry receives a release event and captures client/server errors.
7. **PWA, mobile, SEO, and assets**
   - Confirm `/manifest.webmanifest`, `/sw.js`, `/robots.txt`, `/sitemap.xml`, and icon assets return `200`.
   - Confirm Android Chrome and iOS Safari can install the app and load `/offline` after a cached visit.
   - Confirm Open Graph and Twitter cards use `/icons/og-image.svg`.
8. **Final build gate**
   - Run `npm run typecheck`.
   - Run `npm run build`.
   - Run `ENFORCE_PRODUCTION_ENV=true npm run typecheck` after the production Vercel variables are synced locally if you want the strict environment gate outside Vercel.

## Post-launch testing checklist

1. Visit `/`, `/pricing`, `/gallery`, `/privacy`, `/terms`, `/login`, `/signup`, `/dashboard`, `/studio`, `/marketing`, `/projects`, `/images`, `/templates`, `/brand`, `/billing`, and `/settings`.
2. Sign up, log in, log out, and verify the authenticated dashboard redirects correctly.
3. Create a project and brand kit, then generate an image and confirm the generated asset loads from Supabase storage.
4. Generate marketing copy and save it to a project.
5. Upgrade to Pro and Agency through PayPal live checkout using production test accounts, then cancel from billing.
6. Confirm PayPal webhook events update subscription status in Supabase.
7. Confirm rate limits return `429` with `X-RateLimit-*` headers under repeated API writes.
8. Install the PWA on Android and iOS, launch from the home screen, and verify standalone display mode.
9. Disable network after loading the app once and verify the offline page appears for uncached navigations.
10. Validate `robots.txt`, `sitemap.xml`, metadata, canonical URL, Open Graph image, and Twitter card preview.
11. Check Vercel function logs for structured request entries with `X-Request-Id` and no secret values.
12. Check Sentry for source maps, release health, and any launch errors.
