-- Phase 28: standardize RLS, permission, and admin access for group-bot.

create or replace function public.has_bot_operator_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('reviewer');
$$;

create or replace function public.has_admin_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('admin');
$$;

create or replace function public.has_bot_audit_read_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('senior_reviewer');
$$;

alter table public.bot_groups enable row level security;
alter table public.bot_group_settings enable row level security;
alter table public.bot_members enable row level security;
alter table public.bot_member_events enable row level security;
alter table public.bot_blacklist_items enable row level security;
alter table public.bot_welcome_messages enable row level security;
alter table public.bot_moderation_rules enable row level security;
alter table public.bot_audit_logs enable row level security;

drop policy if exists bot_groups_operator_read on public.bot_groups;
drop policy if exists bot_groups_operator_write on public.bot_groups;
create policy bot_groups_operator_read on public.bot_groups
  for select
  using (public.has_bot_operator_access());
create policy bot_groups_operator_write on public.bot_groups
  for all
  using (public.has_bot_operator_access())
  with check (public.has_bot_operator_access());

drop policy if exists bot_group_settings_operator_manage on public.bot_group_settings;
create policy bot_group_settings_operator_manage on public.bot_group_settings
  for all
  using (public.has_bot_operator_access())
  with check (public.has_bot_operator_access());

drop policy if exists bot_members_operator_manage on public.bot_members;
create policy bot_members_operator_manage on public.bot_members
  for all
  using (public.has_bot_operator_access())
  with check (public.has_bot_operator_access());

drop policy if exists bot_member_events_operator_read on public.bot_member_events;
drop policy if exists bot_member_events_operator_write on public.bot_member_events;
create policy bot_member_events_operator_read on public.bot_member_events
  for select
  using (public.has_bot_operator_access());
create policy bot_member_events_operator_write on public.bot_member_events
  for insert
  with check (public.has_bot_operator_access());

drop policy if exists bot_blacklist_operator_manage on public.bot_blacklist_items;
create policy bot_blacklist_operator_manage on public.bot_blacklist_items
  for all
  using (public.has_bot_operator_access())
  with check (public.has_bot_operator_access());

drop policy if exists bot_welcome_operator_manage on public.bot_welcome_messages;
create policy bot_welcome_operator_manage on public.bot_welcome_messages
  for all
  using (public.has_bot_operator_access())
  with check (public.has_bot_operator_access());

drop policy if exists bot_rules_operator_manage on public.bot_moderation_rules;
create policy bot_rules_operator_manage on public.bot_moderation_rules
  for all
  using (public.has_bot_operator_access())
  with check (public.has_bot_operator_access());

drop policy if exists bot_audit_operator_read on public.bot_audit_logs;
create policy bot_audit_operator_read on public.bot_audit_logs
  for select
  using (public.has_bot_audit_read_access() or public.has_admin_access());

drop policy if exists bot_audit_admin_write on public.bot_audit_logs;
create policy bot_audit_admin_write on public.bot_audit_logs
  for insert
  with check (public.has_bot_operator_access() or public.has_admin_access());

comment on function public.has_bot_operator_access() is 'Allows reviewer and above to operate the group-bot admin surface.';
comment on function public.has_admin_access() is 'Allows admin and super_admin access for privileged operations.';
comment on function public.has_bot_audit_read_access() is 'Restricts bot audit read access to senior reviewer and above.';

update public.roles
set permissions = case name
  when 'reviewer' then permissions || '{"group_bot.read":true,"group_bot.write":true,"group_bot.audit":false}'::jsonb
  when 'senior_reviewer' then permissions || '{"group_bot.read":true,"group_bot.write":true,"group_bot.audit":true}'::jsonb
  when 'admin' then permissions || '{"group_bot.read":true,"group_bot.write":true,"group_bot.audit":true}'::jsonb
  when 'super_admin' then permissions || '{"group_bot.read":true,"group_bot.write":true,"group_bot.audit":true}'::jsonb
  else permissions
end
where name in ('reviewer', 'senior_reviewer', 'admin', 'super_admin');
