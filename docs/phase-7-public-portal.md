# Phase 7 Public Portal

## Public routes

- `/`: landing page.
- `/lookup`: public lookup for active entities.
- `/report`: report form with tracking code response.
- `/track/:trackingCode`: limited report status.
- `/dispute`: correction/dispute form.

## Public APIs

- `GET /api/v1/lookup?q=...`
- `POST /api/v1/reports`
- `GET /api/v1/reports/:trackingCode`
- `POST /api/v1/disputes`

## Privacy rules

- Lookup only returns active entities.
- Tracking returns status, priority and timestamps, not reporter/evidence.
- Public report form does not expose raw report data after submission.
- Dispute is rate-limited and stores requester contact separately from public data.
- No-match result explicitly warns that no data does not mean safe.

## Migration

Run `supabase/migrations/0003_disputes.sql` after the previous migrations.

## Known limitations

- Public attachment upload is not yet enabled.
- Dispute inbox UI is planned for the next case-management phase.
- Email confirmation/notification is not connected.
- Public identifiers are not yet masked per entity type; the current lookup API only exposes active entity fields and should be reviewed before production launch.
