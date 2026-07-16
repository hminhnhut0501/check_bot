# ScamShield

ScamShield is a community scam-reporting and risk-review platform.

## Stack

- Next.js + React + TypeScript: public portal and admin API/UI.
- Supabase: Auth, PostgreSQL, RLS and private evidence storage.
- Render: long-running Telegram worker and broadcast job processing.
- Vercel: Next.js web/API deployment.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Checks:

```bash
npm test
npm run typecheck
npm run build
```

## Supabase migrations

Run these SQL files in order in Supabase SQL Editor or with Supabase CLI:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_report_idempotency.sql`
3. `supabase/migrations/0003_disputes.sql`
4. `supabase/migrations/0004_transactions_rbac_queue.sql`

Then run `supabase/seed.sql` for the development fixture if needed.

## Services

Vercel runs the Next.js application. Render runs the Telegram worker with:

```bash
npm run bot
```

See `render.yaml` and `docs/phase-9e.md` for deployment/backup details.
