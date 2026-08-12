# Production readiness TODO

Scope: `drexdel-backend` (API) and `drexdelnative` (mobile app) are the canonical production applications.

- [x] 1. Establish one canonical backend and mobile client; document legacy copies as non-deployable.
- [x] 2. Restore a releasable mobile build: fix TypeScript errors and consolidate Expo configuration into one valid `expo` object.
- [x] 3. Make background workers deployable: add explicit payment/ticket worker entrypoints, lifecycle handling, and run scripts.
- [x] 4. Complete one payment flow end-to-end before enabling sales: real provider credentials/integration, provider webhook signature verification, idempotency, and ticket issuance for every successful payment method.
  - [x] Stripe card flow: backend creates PaymentIntent; mobile confirms via `@stripe/stripe-react-native` PaymentSheet; Stripe webhook verifies signature and issues ticket.
  - [x] PayPal flow: worker calls PayPal gateway, then issues ticket via shared `PaymentController.issueTicket` (atomic inventory decrement + ticket + COMPLETED).
  - [x] MTN MoMo / Airtel Money: worker requests provider payment (PENDING); telecom webhook verifies HMAC-SHA256 signature and issues ticket on SUCCESSFUL callback.
  - [x] Shared atomic ticket-issuance path (`PaymentController.issueTicket`) used by all providers; idempotent (no-op if already COMPLETED).
- [x] 5. Lock down payment data: ensure only the payer or authorised staff can view a transaction; validate callback ownership and amount/currency.
  - [x] IDOR fix: `getPaymentStatus` now verifies the requesting user owns the transaction (or is STAFF/ADMIN).
  - [x] Telecom webhook signature verification via `TELECOM_WEBHOOK_SECRET` (HMAC-SHA256, constant-time comparison).
  - [x] Callback amount/currency validation against the original payment record.
- [x] 6. Add release automation: reproducible builds, CI for lint/typecheck/tests, production Prisma migrations, and pinned dependency versions.
  - [x] Pinned dependency versions: backend `package.json` no longer uses `latest`/`^` — all deps pinned to exact installed versions; `engines.node` set.
  - [x] Reproducible installs: CI uses `npm ci` against committed `package-lock.json` for both backend and mobile.
  - [x] CI workflow: `.github/workflows/ci.yml` runs typecheck + tests (backend) and typecheck (mobile) on push/PR to `main`, with Node 20 pinned (`.nvmrc`).
  - [x] Production Prisma migrations: existing `prisma/migrations` + `db:generate`, `db:migrate` (deploy), `db:migrate:dev` scripts added.
  - [x] `typecheck` script added to both backend and mobile `package.json`.
- [x] 7. Add production operations: structured/redacted logs, error monitoring, metrics/alerts, database backups plus a restore test, and deployment/runbook documentation.
     - [x] Structured/redacted logs: pino configured with a `redact` censor list (`password`, `token`, `authorization`, `cardNumber`, `cryptographicToken`, etc.); `console.*` calls in redis.ts/errorHandler.ts/app.ts replaced with structured logger.
   - [x] Error monitoring: `src/config/monitoring.ts` with Sentry (lazy-load, no hard dependency) + no-op fallback to structured logs; `captureError` wired into `errorHandler.ts` and the global `uncaughtException` / `unhandledRejection` handlers in `app.ts`; `SENTRY_DSN` added to `env.ts` + `.env.example`.
   - [x] Metrics/alerts: request-counting middleware + `GET /metrics` endpoint (process, memory, request-by-status, error counters); `GET /health` and `GET /ready` health probes; alert guidance in `RUNBOOK.md`.
   - [x] DB backups + restore test: `scripts/backup-db.sh` + `scripts/restore-db.sh`, npm scripts `db:backup`/`db:restore`/`db:restore:test`, and an end-to-end Node restore verification script.
   - [x] Runbook: `drexdel-backend/RUNBOOK.md` covering architecture, env vars, deployment, CI gates, observability, backups/restore, and incident response.
- [~] 8. Add confidence tests: API integration tests with PostgreSQL/Redis, payment webhook verification tests, worker tests, and mobile smoke tests.
  - [x] `__tests__/metrics.test.ts` — real-app (supertest) integration suite covering `GET /health`, `GET /ready`, `GET /metrics`, request-counter increments, and the error-handler → sanitized 500 + `captureError` path (6 tests, all green).
  - [x] Log consolidation audit: `console.*` calls removed from `src/controllers/paymentController.ts` (10 sites), `src/websocket/chatBroker.ts` (3 sites), `src/middleware/errorHandler.ts`, `src/config/redis.ts`, and `src/app.ts`.
  - [ ] PostgreSQL/Redis integration tests (real DB + Redis against a disposable test database).
     - [x] Payment webhook signature-verification unit tests for Stripe + telecom HMAC-SHA256 paths (`__tests__/paymentWebhooks.test.ts`: 8 tests — valid `payment_intent.succeeded` delegates to the telecom handler and issues a ticket, dedup/no re-issuance of an already-processed transaction, invalid Stripe signature → 400, non-payment events acknowledged without delegating, missing-amount/metadata rejected; all passing).
  - [ ] BullMQ worker lifecycle tests (`paymentQueue`, `ticketWorker`).
     - [ ] Mobile smoke test config (`detox` or `expo-test`).
   - [x] Mobile confidence tests (jest-expo): `__tests__/RootErrorBoundary.test.tsx` (fallback + auto-recovery + crash reporting), `__tests__/errorApi.test.ts` (success/error/report-error paths), and `__tests__/performance.test.tsx` (deterministic recovery-timing budget + `presenceApi` p95 latency budget). 93 mobile tests / 15 suites all green.
- [ ] 9. Run a staging launch rehearsal: load test realistic traffic, exercise payment/refund/support flows, and complete security review.

## Release gates

Do not accept live payments until steps 2–5 are complete and verified in staging. Do not launch publicly until steps 6–9 are complete.
