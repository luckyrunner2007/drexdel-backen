# Production readiness TODO

Scope: `drexdel-backend` (API) and `drexdelnative` (mobile app) are the canonical production applications.

- [x] 1. Establish one canonical backend and mobile client; document legacy copies as non-deployable.
- [x] 2. Restore a releasable mobile build: fix TypeScript errors and consolidate Expo configuration into one valid `expo` object.
- [x] 3. Make background workers deployable: add explicit payment/ticket worker entrypoints, lifecycle handling, and run scripts.
- [ ] 4. Complete one payment flow end-to-end before enabling sales: real provider credentials/integration, provider webhook signature verification, idempotency, and ticket issuance for every successful payment method.
- [ ] 5. Lock down payment data: ensure only the payer or authorised staff can view a transaction; validate callback ownership and amount/currency.
- [ ] 6. Add release automation: reproducible builds, CI for lint/typecheck/tests, production Prisma migrations, and pinned dependency versions.
- [ ] 7. Add production operations: structured/redacted logs, error monitoring, metrics/alerts, database backups plus a restore test, and deployment/runbook documentation.
- [ ] 8. Add confidence tests: API integration tests with PostgreSQL/Redis, payment webhook verification tests, worker tests, and mobile smoke tests.
- [ ] 9. Run a staging launch rehearsal: load test realistic traffic, exercise payment/refund/support flows, and complete security review.

## Release gates

Do not accept live payments until steps 2–5 are complete and verified in staging. Do not launch publicly until steps 6–9 are complete.
