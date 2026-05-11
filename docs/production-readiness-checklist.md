# Production Readiness Checklist

Last audited: 2026-05-11

## Build, routes, and API surface

- [x] TypeScript passes with `npm run typecheck`.
- [x] ESLint passes with `npm run lint`.
- [x] Production build passes when required production environment variables are supplied.
- [x] Public routes respond: `/`, `/pricing`, `/login`, `/signup`, `/privacy`, `/terms`, `/offline`, `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml`, `/api/health`.
- [x] Protected app routes redirect unauthenticated visitors through Supabase middleware: `/admin`, `/brand`, `/billing`, `/dashboard`, `/images`, `/marketing`, `/projects`, `/settings`, `/studio`, `/templates`.
- [x] Public gallery has a bounded Supabase query timeout and an empty-state fallback so a slow gallery data source does not block the storefront.
- [x] Health endpoint reports deployment metadata and integration configuration status for uptime checks.

## Supabase and authentication

- [x] Supabase SSR middleware refreshes sessions and protects dashboard routes.
- [x] Auth pages redirect authenticated users away from `/login` and `/signup`.
- [x] Server components use `requireUser` for protected dashboard data access.
- [x] Migrations define profiles, projects, generations, usage events, gallery, billing, notifications, and admin/moderation tables.
- [x] RLS-backed persistence is expected after applying every migration in `supabase/migrations`.
- [ ] Validate with a real Supabase project URL, anon key, service role key, storage bucket, and seeded user before final launch.

## PayPal subscriptions

- [x] Pricing, billing, create-order, capture-order, subscription create/cancel, and webhook routes are present.
- [x] Live PayPal mode requires client credentials and webhook configuration.
- [x] Billing dashboard syncs approved subscriptions and exposes cancellation controls.
- [ ] Validate sandbox subscription approval, webhook signature verification, active plan sync, cancellation, and renewal status with real PayPal sandbox credentials.

## AI generation and usage tracking

- [x] Image generation route checks auth, rate limits, monthly usage, OpenAI image generation, Supabase storage upload, and usage recording.
- [x] Marketing generation route checks auth, brand context, OpenAI copy generation, persistence, and usage recording.
- [x] Usage endpoint returns current usage summary for signed-in users.
- [ ] Run a real authenticated image generation and marketing generation smoke test with valid OpenAI, Supabase, and storage credentials.

## UX polish, loading, empty, and error states

- [x] App-level loading, not-found, route error, and global error screens exist.
- [x] Shared neon black/white/cyan design tokens are centralized in `styles/globals.css`.
- [x] Reduced-motion preferences are respected globally.
- [x] Gallery, dashboard cards, forms, and generation surfaces include empty/loading/error fallbacks.
- [x] Final polish animations are implemented with CSS keyframes and hover states.
- [ ] Complete manual keyboard navigation and screen-reader pass on authenticated flows with production data.

## Mobile, PWA, Android, and iOS

- [x] PWA manifest includes standalone display, portrait orientation, maskable icon, Apple metadata, shortcuts, and theme colors.
- [x] Service worker precaches the marketing shell and serves `/offline` for failed navigations.
- [x] Capacitor config and npm mobile scripts are present for Android/iOS packaging.
- [ ] Generate native PNG icon/splash assets and run `npm run mobile:android` / `npm run mobile:ios` in a workstation with Android Studio and Xcode.
- [ ] Perform responsive QA at 360px, 390px, 768px, 1024px, and desktop widths.

## Security and operations

- [x] Security headers disable framing, sniffing, broad browser permissions, and the `X-Powered-By` header.
- [x] Mutating API requests receive an edge rate limit in middleware.
- [x] Sentry configuration is present for release, trace, profile, and source-map handling.
- [x] Production env validation fails closed when required credentials are missing.
- [ ] Add a committed lockfile once registry access allows `npm install --package-lock-only`; `npm audit` cannot run without it.
- [ ] Rotate all production secrets before launch and verify least-privilege access for Supabase service-role usage.

## Launch gate

Production can ship after the unchecked items above are completed in an environment with real Supabase, OpenAI, PayPal, Sentry, Redis, Android, and iOS credentials/tooling. The codebase currently passes static checks and a production build with required environment variables supplied.
