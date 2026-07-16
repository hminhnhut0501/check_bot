# Phase 9A-9B Implementation Notes

## Phase 9A

- Migration: `supabase/migrations/0004_transactions_rbac_queue.sql`.
- `confirm_report_transaction` locks the report/entity and writes report, entity, review action, audit and optional broadcast job in one transaction.
- `claim_job` uses `FOR UPDATE SKIP LOCKED` and expires stale processing leases.
- `finish_job` completes or fails a claimed job.
- `requirePermission` checks permission JSON for the authenticated user.

## Phase 9B

- Public upload: `POST /api/v1/reports/:trackingCode/attachments`.
- Reviewer preview: `GET /api/admin/attachments/:id/url`.
- Allowlist: JPEG, PNG, WEBP, PDF and TXT.
- Maximum file size: 10 MB.
- Files are stored in private `evidence` bucket.
- Public report form now accepts one evidence file.

## Verification

```bash
npm run typecheck
npm run build
```

Both commands pass in the local workspace.

## Required deployment step

Run migration `0004_transactions_rbac_queue.sql` after migrations `0001`-`0003` before deploying these API changes.
