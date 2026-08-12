# Drexdel — Production Operations Runbook

This runbook covers deployment, day-to-day operations, incident response, and
the verification gates that must pass before the payment stack is considered
production-ready.

## 1. Architecture overview

| Component | Description | Port | Entrypoint |
|-----------|-------------|------|------------|
| **Backend API** (`src/app.ts`) | Express + Prisma + Socket.IO | `5050` | `npm start` |
| **Payment worker** (`src/workers/index.ts`) | BullMQ workers: payment ledger + ticket generation | — | `npm run start:worker` |
| **Mobile app** (`drexdelnative`) | Expo / React Native (`@stripe/stripe-react-native`) | — | `npm start` |

### Payment flow (end-to-end)

1. **Checkout** — Mobile POSTs `/v1/payments/checkout`. The backend validates the
   tier/inventory/amount and creates a pending `Payment` record (idempotent via
   `idempotencyKey`).
2. **Provider** —
   - **Credit Card (Stripe):** a `PaymentIntent` is created; the mobile app
     confirms it via the Stripe PaymentSheet. The webhook finalises the ticket.
   - **PayPal:** the worker calls the PayPal gateway; on success it issues the
     ticket directly.
   - **MTN MoMo / Airtel Money:** the worker requests a provider payment
     (status stays `PENDING`); the ticket is issued when the telecom webhook
     fires a `SUCCESSFUL` callback.
3. **Webhook** — `POST /v1/payments/stripe-webhook` (Stripe signature verified)
   and `POST /v1/payments/telecom-webhook` (HMAC-SHA256 verified via
   `TELECOM_WEBHOOK_SECRET`). Every webhook is de-duplicated via Redis.
4. **Ticket issuance** — `PaymentController.issueTicket()` runs an atomic
   Prisma transaction: conditional inventory decrement (anti-overbooking),
   ticket creation with a cryptographic QR signature, event revenue update,
   and a ticket-delivery job enqueued.
5. **Receipt** — the mobile app polls `/v1/payments/status/:transactionId` until
   the transaction reaches a terminal state, then renders the ticket receipt.

## 2. Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | yes | PostgreSQL connection string. |
| `JWT_SECRET` | yes | HMAC signing key (>32 chars). |
| `REDIS_URL` / `REDIS_HOST` + `REDIS_PORT` | yes | Redis for queues & webhook de-dup. |
| `STRIPE_SECRET_KEY` | prod | Stripe secret key (live or test). |
| `STRIPE_WEBHOOK_SECRET` | prod | Stripe webhook signing secret. |
| `TELECOM_WEBHOOK_SECRET` | prod | HMAC secret for telecom/MoMo callbacks. |
| `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` / `PAYPAL_MODE` | optional | PayPal integration. |
| `SENTRY_DSN` | optional | Error monitoring (falls back to logs if unset). |
| `ALLOWED_ORIGINS` | optional | Comma-separated CORS allow-list. |
| `SKIP_DB_HEALTH` | optional | Set `true` for local health checks without a DB. |

Local config: copy `.env.example` → `.env` for the backend and
`drexdelnative/.env.example` → `.env` for the mobile app.

## 3. Deployment

### Prerequisites
- Node.js 20+ (`.nvmrc` pins the version).
- PostgreSQL 15+ with `pgcrypto` extension.
- Redis 7+ (for BullMQ queues and webhook de-duplication).
- For card payments: Stripe account with `STRIPE_SECRET_KEY` and
  `STRIPE_WEBHOOK_SECRET` (point the webhook at `/v1/payments/stripe-webhook`).

### Deploy backend
```bash
# 1. Provision env (DATABASE_URL, JWT_SECRET, REDIS_URL, payment credentials, SENTRY_DSN)
# 2. Install pinned dependencies (reproducible via npm ci)
npm ci
# 3. Migrate the database in production
npm run db:migrate         # prisma migrate deploy
# 4. Generate the Prisma client
npm run db:generate
# 5. Start the API
npm start
# 6. Start workers (separate process / container)
npm run start:worker
```

### Deploy mobile app
```bash
npm ci
eas build --platform all   # or: npm run build  (web export)
```

The Stripe publishable key is injected via `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
(configured in `app.json` `extra` or the `.env`).

## 4. CI / release gates

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR to `main`:
- **Backend:** `npm ci` → `prisma generate` → `npm run typecheck` → `npm test`.
- **Mobile:** `npm ci` → `npm run typecheck`.

`npm ci` is used (not `npm install`) so the committed `package-lock.json` is the
single source of truth for reproducible builds.

## 5. Observability

### Logs
Structured JSON via pino. Sensitive fields (`password`, `token`,
`authorization`, `cardNumber`, `cryptographicToken`, etc.) are **redacted**
automatically (see `src/config/logger.ts`).

### Error monitoring
When `SENTRY_DSN` is set, unhandled exceptions and Express errors are captured
to Sentry. When unset, errors still go to structured logs — monitoring never
breaks the request path.

### Health checks
- `GET /health` — liveness probe (`? SKIP_DB_HEALTH=true` bypasses the DB ping).
- `GET /ready` — Kubernetes-style readiness probe.
- `GET /metrics` — process + request/error counters (Prometheus-compatible
  structure: `process`, `memory`, `requests`).

### Alerts (operators should configure)
- 5xx error rate > 1% over 5 minutes.
- Webhook failure rate / `issueTicket` failure count rising.
- Payment ledger queue backlog > 1000 jobs for > 2 minutes.
- `/health` returns 503.
- Worker process down (SIGTERM without a clean `process.exit(0)`).

## 6. Database backups & restore

### Backup
```bash
npm run db:backup     # writes ./backups/dump-<db>-<timestamp>.sql.gz
```

### Restore
```bash
npm run db:restore ./backups/dump-drexdel-<timestamp>.sql.gz
```
> **Production note:** take a fresh backup before restoring. `restore-db.sh`
> uses `--single-transaction` and `--clean` to minimise downtime.

### Restore test (run in a safe/throwaway environment)
```bash
# Requires a reachable PostgreSQL via POSTGRES_URL
npm run db:restore:test
```
This creates a disposable database, dumps it, drops it, restores into a new DB,
and verifies the schema survives. It exits non-zero on failure.

## 7. Incident response

| Symptom | Action |
|---------|--------|
| Webhook signatures failing | Verify `STRIPE_WEBHOOK_SECRET` / `TELECOM_WEBHOOK_SECRET` haven't rotated. Check provider dashboard for signing secret. |
| Inventory mismatch / overselling | Inspect the conditional `updateMany` guard in `issueTicket`. Check Redis queue for stuck `drexdel-payment-ledger` jobs. |
| Ticket not issued after successful payment | Check the Stripe webhook reached `/v1/payments/stripe-webhook`; verify the `transactionId` metadata matches a `Payment` record. Re-run `issueTicket` or re-trigger the webhook. |
| Worker down | Check `npm run start:worker` logs; restart the worker process. BullMQ jobs retry automatically (3 attempts, exponential backoff). |
| 502 / queue unavailable at checkout | Redis connectivity; verify workers and Redis are healthy. |
| IDOR / unauthorized transaction view | Confirmed fixed: `getPaymentStatus` enforces ownership; only the payer or STAFF/ADMIN can view. |

## 8. Release checklist

- [x] Steps 1–5 verified in staging (canonical client, mobile build, workers, end-to-end payment, data lock-down).
- [x] Step 6 complete (pinned deps, `npm ci`, CI typecheck+tests, Prisma migrations).
- [ ] Step 7 complete (this runbook; structured/redacted logs; error monitoring; metrics; backups + restore test).
- [ ] Step 8 complete (integration tests with Postgres/Redis, webhook verification, worker tests, mobile smoke tests).
- [ ] Step 9 complete (staging rehearsal: load test, payment/refund/support flows, security review).

> **Release gate:** Do not accept live payments until steps 2–5 are complete and
> verified in staging. Do not launch publicly until steps 6–9 are complete.
