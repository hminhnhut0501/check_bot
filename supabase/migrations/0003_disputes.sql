create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  tracking_code text,
  entity_id uuid references public.scam_entities(id) on delete set null,
  requester_name text,
  requester_email text,
  statement text not null,
  evidence_payload jsonb not null default '{}'::jsonb,
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'accepted', 'rejected', 'closed')),
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index disputes_status_idx on public.disputes (status, created_at desc);
create index disputes_tracking_idx on public.disputes (tracking_code);
alter table public.disputes enable row level security;
create policy disputes_public_insert on public.disputes for insert with check (true);
create policy disputes_staff_read on public.disputes for select using (public.has_role('reviewer'));
create policy disputes_staff_update on public.disputes for update using (public.has_role('reviewer')) with check (public.has_role('reviewer'));
create trigger disputes_updated_at before update on public.disputes for each row execute function public.set_updated_at();
