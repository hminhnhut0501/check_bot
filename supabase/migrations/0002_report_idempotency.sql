alter table public.scam_reports add column if not exists idempotency_key text;
create unique index if not exists scam_reports_idempotency_key_idx
  on public.scam_reports (idempotency_key)
  where idempotency_key is not null;
