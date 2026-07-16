# Phase 2 API And Telegram Intake

## API endpoints

### Public report

```http
POST /api/v1/reports
Content-Type: application/json
X-Idempotency-Key: optional-client-key
```

Required body:

```json
{
  "target_type": "phone",
  "target_name": "0901234567",
  "incident_type": "ecommerce_scam",
  "description": "Mô tả sự việc"
}
```

The response contains `tracking_code`, `status` and `created_at`.

### Tracking

```http
GET /api/v1/reports/:trackingCode
```

Only operational status fields are returned. Reporter identity and raw evidence are not exposed.

### Lookup

```http
GET /api/v1/lookup?q=0901234567
```

The first implementation uses normalized exact match, active entity name match, identifier match and alias match.

### Admin queue

```http
GET /api/admin/reports?status=submitted&page=1&page_size=25
Authorization: Bearer <supabase-access-token>
```

The route requires a reviewer, senior reviewer or admin role.

## Telegram worker

Run with:

```bash
npm run bot
```

Required Render environment variables:

```text
TELEGRAM_BOT_TOKEN
SCAMSHIELD_API_URL
INTERNAL_API_SECRET
```

Supported commands:

- `/start`
- `/help`
- `/check <identifier>`
- `/report`

`/report` opens a five-step in-memory wizard. The final request contains an idempotency key derived from Telegram chat id and message id.

## Current limitations

- Rate limit is process-local and must move to a shared store before horizontal scaling.
- Wizard sessions are in memory; a Render restart resets incomplete reports.
- Telegram attachments are not yet downloaded into Supabase Storage.
- Tracking lookup uses the tracking code as a bearer-like secret and should later support a second verification token.
- Internal bot authentication uses `INTERNAL_API_SECRET`; rotate it independently from Supabase keys.
