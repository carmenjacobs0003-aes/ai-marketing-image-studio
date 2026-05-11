# Syntrix Production Monitoring & Recovery Runbook

Syntrix uses layered stability controls for production launch readiness: health checks, provider retries, abuse prevention, queue protection, centralized logging, critical alerts, and crash-safe generation records.

## Automated health monitoring

- `GET /api/health/live` is a lightweight liveness probe for uptime monitors.
- `GET /api/health/ready` validates launch-critical environment configuration and returns `503` when required production dependencies are missing.
- `GET /api/health` includes deployment metadata plus final application diagnostics.
- `GET /api/diagnostics` returns a compact pass/warn/fail diagnostics payload for CI/CD gates.

## API and provider failure monitoring

- All critical OpenAI, PayPal, generation, abuse, and API failures flow through centralized structured logging and Sentry capture.
- OpenAI and PayPal calls retry transient timeout/rate-limit/5xx errors with exponential backoff and jitter.
- Critical failures can notify an operator webhook via `CRITICAL_ALERT_WEBHOOK_URL` with cooldown control via `CRITICAL_ALERT_COOLDOWN_SECONDS`.

## Abuse, spam, and throttling protections

- Middleware applies request throttling to mutating API routes.
- Image and marketing generation routes add per-user and per-network burst limits.
- Generation queue protection prevents a single user from overloading concurrent queued/processing work.
- Suspicious prompt inspection blocks low-entropy spam, scam language, and disallowed generation intent before provider calls.

## Crash-safe generation flows

- Generation requests are recorded as `processing` before provider calls.
- Successful responses update the record to `completed` only after OpenAI and storage work succeeds.
- Failures update records to `failed` with a user-safe message and do not record quota usage.
- Run `npm run recovery:generations` to mark stale queued/processing jobs as failed after `RECOVERY_CUTOFF_MINUTES` (default `20`).

## Database backup guidance

1. Enable Supabase managed point-in-time recovery for production.
2. Create an encrypted launch backup:

   ```bash
   supabase db dump --project-ref <project-ref> --file backups/$(date +%F)-syntrix.sql
   ```

3. Store backups in encrypted storage with restricted operator access.
4. Validate restores in staging only:

   ```bash
   psql $STAGING_DATABASE_URL < backups/<backup-file>.sql && npm run diagnostics
   ```

5. Test recovery actions quarterly and before major schema launches.

## Production monitoring dashboard

The admin dashboard keeps the Syntrix black/white/neon-blue aesthetic and now includes:

- generation success/error/queue telemetry,
- infrastructure diagnostics,
- recent production incidents,
- audit logs,
- moderation and suspicious activity review queues.

## Launch checklist

- `npm run typecheck`
- `npm run build`
- `npm run diagnostics`
- Confirm `/api/health/ready` returns `200` in production.
- Confirm Sentry and/or `CRITICAL_ALERT_WEBHOOK_URL` receives a test alert.
- Confirm PayPal webhook signature verification is configured with `PAYPAL_WEBHOOK_ID`.
- Confirm Upstash Redis is configured for distributed throttling under load.
