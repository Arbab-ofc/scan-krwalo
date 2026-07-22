# Scan Krwalo Architecture

Scan Krwalo is a TypeScript monorepo with a Fastify modular monolith API, PostgreSQL as the source of truth, Redis for realtime coordination, BullMQ for delayed jobs, and a Next.js App Router web client.

Module boundaries:

- `auth`: signup, login, refresh sessions, password changes, authorization guards.
- `activation-codes`: SCN/CLI generation, secure lookup hashes, redemption transactions.
- `settings`: typed database-backed settings with Redis cache invalidation.
- `tasks`: URL validation, task state machine, posting, claiming, submission, confirmation, expiry.
- `wallets`: scanner wallet ledger and payout reservation accounting.
- `clients`: client profiles and credit ledger.
- `notifications`: persistent notifications, Socket.IO broadcasts, push job handoff.
- `uploads`: S3-compatible proof storage abstraction.
- `admin`: dashboards, settings, activation-code reports, disputes, payouts, audit logs.
- `audit`: immutable sensitive-action history.

PostgreSQL owns all account, task, activation, ledger, payout, and audit state. Redis is used for scanner presence, rate limits, Socket.IO scaling, queue management, and settings cache only.
