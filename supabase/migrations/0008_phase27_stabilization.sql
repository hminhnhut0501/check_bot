-- Phase 27: stabilization hardening for multi-group operations.

alter table public.bot_groups
  alter column status set default 'active';

alter table public.bot_group_settings
  alter column moderation_enabled set default true,
  alter column welcome_enabled set default true,
  alter column join_gate_enabled set default false,
  alter column delete_link_enabled set default true,
  alter column delete_keyword_enabled set default true,
  alter column auto_restrict_enabled set default false;

alter table public.bot_members
  alter column status set default 'member';

alter table public.bot_blacklist_items
  alter column status set default 'active';

alter table public.bot_welcome_messages
  alter column enabled set default true;

alter table public.bot_moderation_rules
  alter column enabled set default true,
  alter column priority set default 100,
  alter column severity set default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bot_blacklist_item_value_not_blank'
      and conrelid = 'public.bot_blacklist_items'::regclass
  ) then
    alter table public.bot_blacklist_items
      add constraint bot_blacklist_item_value_not_blank check (length(trim(item_value)) > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bot_rules_pattern_not_blank'
      and conrelid = 'public.bot_moderation_rules'::regclass
  ) then
    alter table public.bot_moderation_rules
      add constraint bot_rules_pattern_not_blank check (length(trim(pattern)) > 0);
  end if;
end $$;

create index if not exists bot_audit_logs_group_action_idx on public.bot_audit_logs (group_id, action, created_at desc);
create index if not exists bot_audit_logs_group_resource_idx on public.bot_audit_logs (group_id, resource_type, actor_type, created_at desc);
create index if not exists bot_members_group_status_seen_idx on public.bot_members (group_id, status, last_seen_at desc);
create index if not exists bot_welcome_group_enabled_created_idx on public.bot_welcome_messages (group_id, enabled, created_at desc);

create or replace view public.bot_group_runtime_view as
select
  g.id,
  g.telegram_chat_id,
  g.title,
  g.username,
  g.status as group_status,
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

comment on view public.bot_group_runtime_view is 'Operational view for the current group-bot runtime and admin UI.';

