# Phase 1 Setup

## Local setup

1. Cài dependency bằng `npm install`.
2. Copy `.env.example` thành `.env.local` và điền giá trị Supabase.
3. Chạy migration `supabase/migrations/0001_initial_schema.sql` bằng Supabase CLI hoặc SQL Editor.
4. Chạy seed khi cần bằng `supabase/seed.sql`.
5. Chạy `npm run typecheck`.
6. Chạy `npm run dev` rồi kiểm tra `/api/health`.

## Deploy contract

### Vercel

Cần cấu hình:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INTERNAL_API_SECRET`

### Render worker

Worker dùng chung:

- `SUPABASE_URL` hoặc `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_REVIEW_CHAT_ID`
- `TELEGRAM_BROADCAST_CHAT_ID`
- `INTERNAL_API_SECRET`

## Phase 1 handoff

Đã có:

- Database schema và indexes.
- RLS baseline.
- Roles và permissions seed.
- Risk rules seed.
- Server-only Supabase client.
- Health endpoint.
- Environment contract.

Chưa có trong Phase 1:

- Admin login UI.
- Report API.
- Telegram bot handlers.
- Worker claim/retry implementation.
- Storage bucket policies thực thi bằng migration riêng.
