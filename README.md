# Scan Krwalo

Post. Grab. Complete. Earn.

Scan Krwalo is a TypeScript monorepo with a Next.js web app, Fastify API, Prisma/PostgreSQL database layer, Redis-backed realtime coordination, BullMQ workers, and S3-compatible proof storage.

## Local Setup

```bash
cd scan-krwalo
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- Health: `http://localhost:4000/health`
- Readiness: `http://localhost:4000/ready`
- MinIO console: `http://localhost:9001`

Local seed credentials:

- Admin email: `admin@scan-krwalo.local`
- Admin password: value of `ADMIN_SEED_PASSWORD` in `.env`
- Scanner: `scanner@scan-krwalo.local` / `ScannerSeed123!`
- Client: `client@scan-krwalo.local` / `ClientSeed123!`

Production must provide explicit secure admin seed parameters. Do not reuse local seed credentials.

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm docker:up
pnpm docker:down
```

## Architecture

- `apps/api`: Fastify modular monolith API and worker entry points.
- `apps/web`: Next.js App Router frontend.
- `packages/database`: Prisma schema, client export, seed.
- `packages/shared`: shared Zod schemas, code generation, URL, money, task-state helpers.

PostgreSQL is the source of truth for users, activation codes, tasks, ledgers, payouts, notifications, and audits. Redis is reserved for presence, queues, short-lived coordination, and cache. The Next.js process does not hold critical state.

## Database Models

`User`, `UserSession`, `ScannerProfile`, `ClientProfile`, `ActivationCode`, `SystemSetting`, `Task`, `TaskClaim`, `TaskSubmission`, `TaskProof`, `TaskEvent`, `TaskDispute`, `ClientCreditAccount`, `ClientCreditTransaction`, `ScannerWallet`, `ScannerWalletTransaction`, `PayoutRequest`, `Notification`, `PushSubscription`, `AuditLog`.

## API Routes

Auth:

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/change-password`

Activation:

- `POST /api/v1/activation/redeem`
- `GET /api/v1/activation/status`

Tasks:

- `POST /api/v1/tasks`
- `GET /api/v1/tasks`
- `GET /api/v1/tasks/:id`
- `POST /api/v1/tasks/:id/claim`
- `POST /api/v1/tasks/:id/submit`
- `POST /api/v1/tasks/:id/confirm`
- `POST /api/v1/tasks/:id/dispute`
- `POST /api/v1/tasks/:id/cancel`

Scanner:

- `GET /api/v1/scanner/dashboard`
- `GET /api/v1/scanner/live-tasks`
- `GET /api/v1/scanner/current-task`
- `GET /api/v1/scanner/history`
- `PATCH /api/v1/scanner/profile`
- `POST /api/v1/scanner/presence/online`
- `POST /api/v1/scanner/presence/offline`
- `GET /api/v1/scanner/wallet`
- `GET /api/v1/scanner/wallet/transactions`
- `POST /api/v1/scanner/payouts`
- `GET /api/v1/scanner/payouts`

Client:

- `GET /api/v1/client/dashboard`
- `GET /api/v1/client/credits`
- `GET /api/v1/client/credit-transactions`
- `GET /api/v1/client/tasks`

Admin:

- `GET /api/v1/admin/dashboard`
- `POST /api/v1/admin/activation-codes/scanner`
- `POST /api/v1/admin/activation-codes/client`
- `GET /api/v1/admin/activation-codes`
- `GET /api/v1/admin/activation-codes/:id`
- `POST /api/v1/admin/activation-codes/:id/revoke`
- `GET /api/v1/admin/scanners`
- `GET /api/v1/admin/clients`
- `PATCH /api/v1/admin/users/:id/status`
- `GET /api/v1/admin/tasks`
- `GET /api/v1/admin/disputes`
- `POST /api/v1/admin/disputes/:id/resolve`
- `GET /api/v1/admin/payouts`
- `POST /api/v1/admin/payouts/:id/processing`
- `POST /api/v1/admin/payouts/:id/paid`
- `POST /api/v1/admin/payouts/:id/reject`
- `GET /api/v1/admin/settings`
- `PATCH /api/v1/admin/settings`
- `GET /api/v1/admin/audit-logs`

Notifications:

- `GET /api/v1/notifications`
- `GET /api/v1/notifications/unread-count`
- `POST /api/v1/notifications/:id/read`
- `POST /api/v1/notifications/read-all`

Settings:

- `GET /api/v1/settings/public`

## Socket.IO Events

Implemented server entry point and rooms for:

- Rooms: `user:{userId}`, `role:scanner`, `role:client`, `role:admin`
- Client event: `presence:heartbeat`
- Server event: `presence:updated`

Planned/contracted event names in code/docs: `task:available`, `task:claimed`, `task:removed`, `task:updated`, `task:submitted`, `task:confirmed`, `task:expired`, `notification:new`, `notification:read`, `wallet:updated`, `credits:updated`, `payout:updated`, `presence:updated`.

## BullMQ Jobs

Queues:

- `task-expiration`
- `notifications`
- `push-notifications`
- `maintenance`

Jobs:

- `expire-unclaimed-task`
- `expire-incomplete-task`
- `auto-complete-client-review`
- `send-push-notification`
- `cleanup-expired-presence`
- `recalculate-performance-summary`

## Critical Accounting

Atomic task claiming uses a PostgreSQL transaction, one-active-task check, a conditional `updateMany` against `AVAILABLE` status and `claimExpiresAt > now`, plus a partial unique index over active assigned scanner states.

Task settlement is transactional. Confirmation creates scanner wallet reward ledger, updates wallet/profile derived totals, consumes reserved client credit through the credit ledger, updates the task state, and records task events.

Client credits are never just decremented silently. Task posting reserves one credit in the same transaction as task creation. Completion moves reserved to used. Refund paths are modeled through ledger transaction types.

Payouts reserve funds first: available balance decreases and reserved-for-payout increases. Paid payouts reduce reserved and increase lifetime paid. Rejected payouts release reserved funds back to available balance.

## Deployment Notes

- Run API, worker, and web as separate processes.
- Use managed PostgreSQL and Redis.
- Use R2/S3/MinIO-compatible object storage for proofs.
- Set strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
- Run `pnpm db:migrate` before starting new API versions.
- Run at least one worker process for task expiry and auto-completion.
- Configure CORS to the production web origin only.
