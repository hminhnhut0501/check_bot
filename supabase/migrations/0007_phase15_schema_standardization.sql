-- Phase 15: schema standardization and migration bookkeeping.
-- This file hardens the group-bot schema without relying on legacy tables.

create table if not exists public.bot_schema_versions (
  id integer primary key default 1,
  core_version text not null,
  seed_version text not null,
  applied_at timestamptz not null default timezone('utc', now()),
  notes text
);

insert into public.bot_schema_versions (id, core_version, seed_version, notes)
values (1, '0005_group_bot_core', '0006_phase14_seed_group_bot', 'Phase 15 standardization checkpoint')
on conflict (id) do update
  set core_version = excluded.core_version,
      seed_version = excluded.seed_version,
      applied_at = timezone('utc', now()),
      notes = excluded.notes;

create index if not exists bot_groups_status_idx on public.bot_groups (status, updated_at desc);
create index if not exists bot_members_status_idx on public.bot_members (group_id, status, updated_at desc);
create index if not exists bot_blacklist_status_idx on public.bot_blacklist_items (group_id, status, updated_at desc);
create index if not exists bot_welcome_enabled_idx on public.bot_welcome_messages (group_id, enabled, updated_at desc);

create or replace view public.bot_group_config_view as
select
  g.id,
  g.telegram_chat_id,
  g.title,
  g.username,
  g.status,
  gs.moderation_enabled,
  gs.welcome_enabled,
  gs.join_gate_enabled,
  gs.delete_link_enabled,
  gs.delete_keyword_enabled,
  gs.auto_restrict_enabled,
  gs.config_json,
  g.created_at,
  g.updated_at
from public.bot_groups g
left join public.bot_group_settings gs on gs.group_id = g.id;

comment on table public.bot_groups is 'Core group registry for the new single-bot multi-group architecture.';
comment on table public.bot_group_settings is 'Per-group runtime configuration.';
comment on table public.bot_members is 'Current member snapshot per group.';
comment on table public.bot_member_events is 'Immutable member lifecycle events.';
comment on table public.bot_blacklist_items is 'Group-scoped blacklist entries.';
comment on table public.bot_welcome_messages is 'Welcome message templates.';
comment on table public.bot_moderation_rules is 'Moderation engine rules.';
comment on table public.bot_audit_logs is 'Administrative and bot audit trail.';
