create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default timezone('utc', now()),
  last_login_at timestamptz
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('reviewer', 'senior_reviewer', 'admin', 'super_admin')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, role_id)
);

create table public.scam_entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('person', 'phone', 'bank_account', 'telegram_user', 'telegram_group', 'website', 'domain', 'email', 'crypto_wallet', 'social_account', 'company', 'unknown')),
  display_name text not null,
  normalized_name text not null,
  risk_level text not null default 'unknown' check (risk_level in ('unknown', 'low', 'medium', 'high', 'critical', 'cleared')),
  risk_score numeric(5, 2) not null default 0 check (risk_score between 0 and 100),
  status text not null default 'under_review' check (status in ('under_review', 'active', 'disabled', 'disputed', 'archived')),
  description text,
  country text,
  source_count integer not null default 0 check (source_count >= 0),
  confirmed_report_count integer not null default 0 check (confirmed_report_count >= 0),
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.entity_identifiers (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.scam_entities(id) on delete cascade,
  identifier_type text not null,
  identifier_value text not null,
  normalized_value text not null,
  is_primary boolean not null default false,
  confidence_score numeric(5, 2) not null default 100 check (confidence_score between 0 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  unique (identifier_type, normalized_value)
);

create table public.scam_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.scam_entities(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  alias_type text not null default 'name',
  source_report_id uuid,
  confidence_score numeric(5, 2) not null default 80 check (confidence_score between 0 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  unique (entity_id, normalized_alias)
);

create table public.scam_reports (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique,
  reporter_user_id uuid references public.profiles(id) on delete set null,
  reporter_chat_id text,
  source_type text not null default 'web' check (source_type in ('web', 'telegram', 'admin', 'api')),
  source_chat_id text,
  source_message_id text,
  target_name text not null,
  target_type text not null,
  incident_type text not null,
  incident_date timestamptz,
  amount numeric(18, 2),
  currency text,
  description text not null,
  evidence_text text,
  evidence_payload jsonb not null default '{}'::jsonb,
  status text not null default 'submitted' check (status in ('submitted', 'triaged', 'assigned', 'investigating', 'need_more_info', 'confirmed', 'rejected', 'duplicate', 'disputed', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  confidence_score numeric(5, 2) not null default 0 check (confidence_score between 0 and 100),
  risk_score numeric(5, 2) not null default 0 check (risk_score between 0 and 100),
  assigned_to uuid references public.profiles(id) on delete set null,
  duplicate_of uuid references public.scam_reports(id) on delete set null,
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.scam_aliases
  add constraint scam_aliases_source_report_fk
  foreign key (source_report_id) references public.scam_reports(id) on delete set null;

create table public.scam_report_attachments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.scam_reports(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  telegram_file_id text,
  sha256 text,
  ocr_text text,
  metadata jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  case_code text not null unique,
  title text not null,
  summary text,
  status text not null default 'open' check (status in ('open', 'investigating', 'pending_review', 'confirmed', 'monitoring', 'closed', 'archived')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  owner_id uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.case_reports (
  case_id uuid not null references public.cases(id) on delete cascade,
  report_id uuid not null references public.scam_reports(id) on delete cascade,
  relation_type text not null default 'related',
  created_at timestamptz not null default timezone('utc', now()),
  primary key (case_id, report_id)
);

create table public.case_entities (
  case_id uuid not null references public.cases(id) on delete cascade,
  entity_id uuid not null references public.scam_entities(id) on delete cascade,
  relation_type text not null default 'related',
  confidence_score numeric(5, 2) not null default 100 check (confidence_score between 0 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (case_id, entity_id)
);

create table public.entity_relations (
  id uuid primary key default gen_random_uuid(),
  source_entity_id uuid not null references public.scam_entities(id) on delete cascade,
  target_entity_id uuid not null references public.scam_entities(id) on delete cascade,
  relation_type text not null,
  confidence_score numeric(5, 2) not null default 80 check (confidence_score between 0 and 100),
  source_report_id uuid references public.scam_reports(id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  check (source_entity_id <> target_entity_id),
  unique (source_entity_id, target_entity_id, relation_type)
);

create table public.review_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.scam_reports(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.scam_broadcasts (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references public.scam_entities(id) on delete set null,
  report_id uuid references public.scam_reports(id) on delete set null,
  channel_type text not null default 'telegram',
  channel_id text not null,
  message_id text,
  message_text text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'retrying', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.scam_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  rule_type text not null,
  pattern jsonb not null default '{}'::jsonb,
  score numeric(5, 2) not null,
  enabled boolean not null default true,
  priority integer not null default 100,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.job_queue (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default timezone('utc', now()),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now())
);

create index scam_entities_name_trgm_idx on public.scam_entities using gin (normalized_name gin_trgm_ops);
create index scam_entities_status_risk_idx on public.scam_entities (status, risk_level, updated_at desc);
create index entity_identifiers_lookup_idx on public.entity_identifiers (identifier_type, normalized_value);
create index scam_aliases_lookup_idx on public.scam_aliases (normalized_alias);
create index scam_reports_queue_idx on public.scam_reports (status, priority, created_at desc);
create index scam_reports_target_idx on public.scam_reports (target_type, target_name);
create index scam_reports_assignee_idx on public.scam_reports (assigned_to, status);
create index attachments_report_idx on public.scam_report_attachments (report_id);
create index review_actions_report_idx on public.review_actions (report_id, created_at desc);
create index broadcasts_status_idx on public.scam_broadcasts (status, created_at);
create index jobs_claim_idx on public.job_queue (status, available_at);
create index audit_resource_idx on public.audit_logs (resource_type, resource_id, created_at desc);

create trigger scam_entities_updated_at before update on public.scam_entities for each row execute function public.set_updated_at();
create trigger scam_reports_updated_at before update on public.scam_reports for each row execute function public.set_updated_at();
create trigger cases_updated_at before update on public.cases for each row execute function public.set_updated_at();
create trigger broadcasts_updated_at before update on public.scam_broadcasts for each row execute function public.set_updated_at();
create trigger rules_updated_at before update on public.scam_rules for each row execute function public.set_updated_at();

create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name in (required_role, 'admin', 'super_admin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.scam_entities enable row level security;
alter table public.entity_identifiers enable row level security;
alter table public.scam_aliases enable row level security;
alter table public.scam_reports enable row level security;
alter table public.scam_report_attachments enable row level security;
alter table public.cases enable row level security;
alter table public.case_reports enable row level security;
alter table public.case_entities enable row level security;
alter table public.entity_relations enable row level security;
alter table public.review_actions enable row level security;
alter table public.scam_broadcasts enable row level security;
alter table public.scam_rules enable row level security;
alter table public.job_queue enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.has_role('admin'));
create policy profiles_admin_write on public.profiles for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy roles_admin_read on public.roles for select using (public.has_role('admin'));
create policy user_roles_admin_manage on public.user_roles for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy entities_public_read on public.scam_entities for select using (status = 'active');
create policy entities_staff_read on public.scam_entities for select using (public.has_role('reviewer'));
create policy entities_staff_write on public.scam_entities for insert with check (public.has_role('reviewer'));
create policy entities_staff_update on public.scam_entities for update using (public.has_role('reviewer')) with check (public.has_role('reviewer'));

create policy identifiers_public_read on public.entity_identifiers for select using (exists (select 1 from public.scam_entities e where e.id = entity_id and e.status = 'active'));
create policy identifiers_staff_manage on public.entity_identifiers for all using (public.has_role('reviewer')) with check (public.has_role('reviewer'));
create policy aliases_public_read on public.scam_aliases for select using (exists (select 1 from public.scam_entities e where e.id = entity_id and e.status = 'active'));
create policy aliases_staff_manage on public.scam_aliases for all using (public.has_role('reviewer')) with check (public.has_role('reviewer'));

create policy reports_reporter_read on public.scam_reports for select using (reporter_user_id = auth.uid() or public.has_role('reviewer'));
create policy reports_authenticated_create on public.scam_reports for insert with check (reporter_user_id = auth.uid() or public.has_role('reviewer'));
create policy reports_staff_update on public.scam_reports for update using (public.has_role('reviewer')) with check (public.has_role('reviewer'));

create policy attachments_reporter_read on public.scam_report_attachments for select using (exists (select 1 from public.scam_reports r where r.id = report_id and r.reporter_user_id = auth.uid()) or public.has_role('reviewer'));
create policy attachments_staff_manage on public.scam_report_attachments for all using (public.has_role('reviewer')) with check (public.has_role('reviewer'));

create policy cases_staff_manage on public.cases for all using (public.has_role('reviewer')) with check (public.has_role('reviewer'));
create policy case_reports_staff_manage on public.case_reports for all using (public.has_role('reviewer')) with check (public.has_role('reviewer'));
create policy case_entities_staff_manage on public.case_entities for all using (public.has_role('reviewer')) with check (public.has_role('reviewer'));
create policy relations_staff_manage on public.entity_relations for all using (public.has_role('reviewer')) with check (public.has_role('reviewer'));
create policy review_actions_staff_read on public.review_actions for select using (public.has_role('reviewer'));
create policy broadcasts_staff_manage on public.scam_broadcasts for all using (public.has_role('reviewer')) with check (public.has_role('reviewer'));
create policy rules_admin_manage on public.scam_rules for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy jobs_admin_read on public.job_queue for select using (public.has_role('admin'));
create policy audit_admin_read on public.audit_logs for select using (public.has_role('admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence',
  'evidence',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy evidence_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'evidence' and public.has_role('reviewer'));

create policy evidence_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidence' and public.has_role('reviewer'));

create policy evidence_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'evidence' and public.has_role('reviewer'))
  with check (bucket_id = 'evidence' and public.has_role('reviewer'));

create policy evidence_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'evidence' and public.has_role('admin'));

insert into public.roles (name, permissions) values
  ('reviewer', '{"reports.read":true,"reports.assign":true,"reports.review":true,"entities.read":true,"entities.write":true}'::jsonb),
  ('senior_reviewer', '{"reports.read":true,"reports.assign":true,"reports.review":true,"reports.confirm":true,"entities.read":true,"entities.write":true,"entities.merge":true,"broadcasts.send":true}'::jsonb),
  ('admin', '{"*":true}'::jsonb),
  ('super_admin', '{"*":true}'::jsonb)
on conflict (name) do update set permissions = excluded.permissions;

insert into public.scam_rules (name, rule_type, pattern, score, priority) values
  ('confirmed-report', 'confirmed_report', '{"status":"confirmed"}'::jsonb, 40, 10),
  ('independent-reporters', 'reporter_count', '{"minimum":2}'::jsonb, 25, 20),
  ('transaction-evidence', 'evidence_type', '{"type":"transaction"}'::jsonb, 10, 30),
  ('attachment-present', 'attachment_count', '{"minimum":1}'::jsonb, 10, 40)
on conflict (name) do nothing;
