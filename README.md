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
- `POST /api/v1/tasks/bulk`
- `GET /api/v1/tasks`
- `GET /api/v1/tasks/proofs/:key`
- `GET /api/v1/tasks/:id`
- `POST /api/v1/tasks/:id/claim`
- `POST /api/v1/tasks/:id/submit`
- `POST /api/v1/tasks/:id/confirm`
- `POST /api/v1/tasks/:id/dispute`
- `POST /api/v1/tasks/:id/cancel`

Scanner:

- `GET /api/v1/scanner/dashboard`
- `GET /api/v1/scanner/telegram`
- `POST /api/v1/scanner/telegram/link`
- `DELETE /api/v1/scanner/telegram`
- `GET /api/v1/scanner/live-tasks`
- `GET /api/v1/scanner/current-task`
- `GET /api/v1/scanner/history`
- `PATCH /api/v1/scanner/profile`
- `POST /api/v1/scanner/presence/online`
- `POST /api/v1/scanner/presence/offline`
- `GET /api/v1/scanner/presence/status`
- `GET /api/v1/scanner/wallet`
- `GET /api/v1/scanner/wallet/transactions`
- `POST /api/v1/scanner/payouts`
- `GET /api/v1/scanner/payouts`

Client:

- `GET /api/v1/client/dashboard`
- `GET /api/v1/client/credits`
- `GET /api/v1/client/scanner-presence`
- `GET /api/v1/client/credit-transactions`
- `GET /api/v1/client/tasks`

Admin:

- `GET /api/v1/admin/dashboard`
- `POST /api/v1/admin/activation-codes/scanner`
- `POST /api/v1/admin/activation-codes/client`
- `GET /api/v1/admin/activation-codes`
- `GET /api/v1/admin/activation-codes/:id`
- `POST /api/v1/admin/activation-codes/:id/revoke`
- `DELETE /api/v1/admin/activation-codes/:id`
- `GET /api/v1/admin/scanners`
- `GET /api/v1/admin/clients`
- `PATCH /api/v1/admin/users/:id/status`
- `GET /api/v1/admin/tasks/export.csv`
- `GET /api/v1/admin/tasks/:id`
- `GET /api/v1/admin/tasks`
- `GET /api/v1/admin/reports/:report/export.csv`
- `GET /api/v1/admin/reports/:report`
- `GET /api/v1/admin/disputes`
- `POST /api/v1/admin/disputes/:id/resolve`
- `GET /api/v1/admin/payouts`
- `POST /api/v1/admin/payouts/:id/processing`
- `POST /api/v1/admin/payouts/:id/paid`
- `POST /api/v1/admin/payouts/:id/reject`
- `GET /api/v1/admin/settings`
- `PATCH /api/v1/admin/settings`
- `POST /api/v1/admin/notifications/test-push`
- `GET /api/v1/admin/telegram/webhook`
- `POST /api/v1/admin/telegram/webhook`
- `GET /api/v1/admin/audit-logs`

Notifications:

- `GET /api/v1/notifications`
- `GET /api/v1/notifications/unread-count`
- `POST /api/v1/notifications/:id/read`
- `POST /api/v1/notifications/read-all`

Push:

- `GET /api/v1/push-subscriptions/public-key`
- `POST /api/v1/push-subscriptions`
- `POST /api/v1/push-subscriptions/test`
- `DELETE /api/v1/push-subscriptions/:id`

Telegram:

- `POST /api/v1/telegram/webhook`

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

- Run API, worker, and web as separate processes for paid production.
- For a free Render setup, `render.yaml` runs the API and BullMQ workers in one web service with `RUN_WORKER_IN_API=true`.
- Use managed PostgreSQL and Redis.
- Use R2/S3/MinIO-compatible object storage for proofs. Render's local filesystem is ephemeral and should not be used for permanent proof files.
- Set strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
- Run `pnpm db:deploy` before starting new API versions.
- Configure CORS to the production web origin only.

### Free Render API Deployment

This repository includes `render.yaml` for deploying the API to Render as a Blueprint.

Free-friendly architecture:

- API: Render Web Service, free plan.
- Database: Neon Postgres free plan.
- Redis: Upstash Redis free plan.
- Proof storage: Cloudflare R2 free tier.
- Frontend: Vercel Hobby or another static/Next.js host. Vercel Hobby is for personal use, so use a business-appropriate plan/provider when required.

Render steps:

1. Push this repository to GitHub.
2. Create a Neon Postgres database and copy its pooled connection string.
3. Create an Upstash Redis database and copy the Redis URL.
4. Create a Cloudflare R2 bucket and access keys.
5. In Render, choose **New > Blueprint** and connect this repository.
6. Render will read `render.yaml` and create `scan-krwalo-api`.
7. Add the required environment variables in Render before the first deploy completes.

Required Render environment variables:

```bash
WEB_URL=https://your-frontend-domain.com
API_URL=https://your-render-service.onrender.com
CORS_ORIGINS=https://your-frontend-domain.com
DATABASE_URL=postgresql://...
REDIS_URL=rediss://...
JWT_ACCESS_SECRET=use-a-long-random-secret
JWT_REFRESH_SECRET=use-another-long-random-secret
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=scan-krwalo-proofs
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_FORCE_PATH_STYLE=true
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_VAPID_PUBLIC_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=YourBotUsername
TELEGRAM_WEBHOOK_SECRET=optional-random-secret
RUN_WORKER_IN_API=true
```

Firebase web push alerts:

1. Create a Firebase Web app and generate a Web Push certificate (VAPID key).
2. Set the four Firebase variables above on the API deployment. Keep the service-account private key secret.
3. Confirm `https://your-web-domain.com/firebase-messaging-sw.js` is publicly accessible.
4. Scanners click **Enable push notifications** from the scanner dashboard. Their Firebase browser token is stored against their account.

Telegram scanner alerts:

1. Create a bot with BotFather and copy the bot token.
2. Configure `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, and optionally `TELEGRAM_WEBHOOK_SECRET` in environment variables, or enter them in **Admin > Settings**.
3. Click **Install Telegram webhook** in Admin settings. The API saves the current admin-panel values when present, then calls Telegram `setWebhook` with the configured token and webhook secret.

Scanners then open the scanner dashboard, generate a Telegram link, and press Start in the bot.

Optional seed variables, only when running the seed command:

```bash
ADMIN_SEED_USERNAME=admin
ADMIN_SEED_EMAIL=admin@example.com
ADMIN_SEED_PASSWORD=change-this-to-a-strong-password
```

To seed the production admin once from your machine, temporarily point your local `.env` at the production `DATABASE_URL`, set the `ADMIN_SEED_*` variables, then run:

```bash
pnpm db:generate
pnpm db:seed
```

Do not commit production secrets.

Frontend deployment:

1. Deploy `apps/web` to Vercel or another Next.js host.
2. Set these frontend environment variables:

```bash
NEXT_PUBLIC_API_URL=https://your-render-service.onrender.com/api/v1
NEXT_PUBLIC_SOCKET_URL=https://your-render-service.onrender.com
```

3. After the frontend URL is assigned, update Render:

```bash
WEB_URL=https://your-frontend-domain.com
CORS_ORIGINS=https://your-frontend-domain.com
API_URL=https://your-render-service.onrender.com
```

Free plan limitations:

- Render free web services spin down after idle time, so the first request after inactivity can be slow.
- Background jobs only run while the free API service is awake when `RUN_WORKER_IN_API=true`.
- For business-critical usage, move the worker to a dedicated paid Render Background Worker and set `RUN_WORKER_IN_API=false` on the API.
- Do not rely on Render's filesystem for uploaded proof images.
