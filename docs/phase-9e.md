# Phase 9E Tests, Monitoring And Backup

## Tests

```bash
npm test
npm run typecheck
npm run build
```

Current tests cover normalization, tracking codes, risk score factors and duplicate scoring.

## Monitoring

- `/api/health` checks database, queue backlog and pending/failed broadcasts.
- `/api/admin/metrics` exposes operational records to reviewers.
- Render worker should poll health and alert when queue failure count grows.

## Backup

```bash
SUPABASE_DB_URL=... npm run backup
```

The script uses `pg_dump` custom format and writes to `BACKUP_DIR` or `./backups`. Configure a scheduled Render job or external scheduler and copy dumps to durable storage.
