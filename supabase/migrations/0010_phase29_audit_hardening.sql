-- Phase 29: audit hardening for taxonomy, retention, and reporting.

alter table public.bot_audit_logs
  add column if not exists event_family text,
  add column if not exists event_kind text,
  add column if not exists retention_days integer not null default 365,
  add column if not exists expires_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bot_audit_logs_event_family_check'
      and conrelid = 'public.bot_audit_logs'::regclass
  ) then
    alter table public.bot_audit_logs
      add constraint bot_audit_logs_event_family_check check (event_family is null or event_family in ('group', 'settings', 'rule', 'member', 'blacklist', 'welcome', 'system'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bot_audit_logs_retention_days_check'
      and conrelid = 'public.bot_audit_logs'::regclass
  ) then
    alter table public.bot_audit_logs
      add constraint bot_audit_logs_retention_days_check check (retention_days between 1 and 3650);
  end if;
end $$;

update public.bot_audit_logs
set
  event_family = coalesce(
    event_family,
    case
      when resource_type = 'group' then 'group'
      when resource_type = 'moderation_rule' then 'rule'
      when resource_type = 'blacklist_item' then 'blacklist'
      when resource_type = 'welcome_message' then 'welcome'
      when resource_type = 'member' then 'member'
      when action like 'group.%' or action like 'settings.%' then 'settings'
      when action like 'member.%' then 'member'
      when action like 'rule.%' then 'rule'
      when action like 'blacklist.%' then 'blacklist'
      when action like 'welcome.%' then 'welcome'
      else 'system'
    end
  ),
  event_kind = coalesce(event_kind, action),
  retention_days = coalesce(retention_days, case
    when resource_type = 'member' or action like 'member.%' then 180
    else 365
  end),
  expires_at = coalesce(expires_at, created_at + make_interval(days => coalesce(retention_days, case when resource_type = 'member' or action like 'member.%' then 180 else 365 end)))
where event_family is null or event_kind is null or expires_at is null;

create index if not exists bot_audit_logs_group_family_idx on public.bot_audit_logs (group_id, event_family, created_at desc);
create index if not exists bot_audit_logs_group_kind_idx on public.bot_audit_logs (group_id, event_kind, created_at desc);
create index if not exists bot_audit_logs_expires_at_idx on public.bot_audit_logs (expires_at);

create or replace view public.bot_audit_report_view as
select
  group_id,
  event_family,
  event_kind,
  actor_type,
  resource_type,
  count(*)::bigint as event_count,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from public.bot_audit_logs
group by group_id, event_family, event_kind, actor_type, resource_type;

create or replace function public.prune_bot_audit_logs(p_before timestamptz default timezone('utc', now()))
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  removed_count bigint;
begin
  delete from public.bot_audit_logs
  where expires_at is not null
    and expires_at < p_before;

  get diagnostics removed_count = row_count;
  return coalesce(removed_count, 0);
end;
$$;

comment on view public.bot_audit_report_view is 'Aggregated audit reporting view grouped by family, kind, actor, and resource.';
comment on function public.prune_bot_audit_logs(timestamptz) is 'Removes expired audit rows according to per-row retention.';

