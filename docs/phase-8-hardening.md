# Phase 8 Hardening

## Security controls

- Supabase session refresh middleware.
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY`.
- Strict referrer policy.
- Permissions policy disabling camera, microphone and geolocation.
- HSTS in production.
- Public lookup masking for phone, bank account and email values.
- Request body limits for public report/dispute APIs.
- Role-protected dispute inbox and audit logs.

## New routes

- `/admin/disputes`
- `GET /api/admin/disputes`
- `POST /api/admin/disputes/:id/action`

## Deployment checklist

- Run migrations `0001`, `0002` and `0003` in order.
- Configure all variables in `.env.example` on Vercel and Render.
- Rotate `INTERNAL_API_SECRET` if it has ever been exposed.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Configure Supabase database backups/export policy.
- Set Render worker health monitoring and restart policy.
- Set Vercel/Render log retention and alerting.
- Test Telegram broadcast in a private channel before production channel.
- Review public masking with real identifier examples before launch.
- Run `npm audit` and review dependency advisories before release.

## Verification

```bash
npm run typecheck
npm run build
```

## Remaining production risks

- In-memory rate limiting is not shared across instances.
- Job queue claim needs database locking before multiple workers run concurrently.
- No automated integration test against a Supabase project is available in this workspace.
- Email notification and attachment malware scanning are not implemented.
