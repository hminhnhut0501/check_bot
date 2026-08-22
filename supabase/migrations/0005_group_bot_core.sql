create extension if not exists pgcrypto;

create table if not exists public.bot_groups (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id text not null unique,
  title text not null,
  username text,
  status text not null default 'active' check (status in ('active', 'paused', 'removed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bot_group_settings (
  group_id uuid primary key references public.bot_groups(id) on delete cascade,
  moderation_enabled boolean not null default true,
  welcome_enabled boolean not null default true,
  join_gate_enabled boolean not null default false,
  delete_link_enabled boolean not null default true,
  delete_keyword_enabled boolean not null default true,
  auto_restrict_enabled boolean not null default false,
  config_json jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bot_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.bot_groups(id) on delete cascade,
  telegram_user_id text not null,
  username text,
  display_name text,
  status text not null default 'member' check (status in ('member', 'restricted', 'left', 'banned')),
  joined_at timestamptz,
  left_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (group_id, telegram_user_id)
);

create table if not exists public.bot_member_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.bot_groups(id) on delete cascade,
  telegram_user_id text not null,
  event_type text not null check (event_type in ('join', 'leave', 'restrict', 'ban', 'unban', 'promote', 'demote', 'message_deleted', 'warning')),
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bot_blacklist_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.bot_groups(id) on delete cascade,
  item_type text not null check (item_type in ('user_id', 'username', 'keyword', 'phrase', 'domain', 'link', 'phone')),
  item_value text not null,
  normalized_value text not null,
  reason text,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bot_welcome_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.bot_groups(id) on delete cascade,
  variant_name text not null default 'default',
  message_text text not null,
  enabled boolean not null default true,
  conditions_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bot_moderation_rules (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.bot_groups(id) on delete cascade,
  rule_type text not null check (rule_type in ('keyword', 'link', 'domain', 'flood', 'repeated_text', 'mention', 'join_gate')),
  pattern text not null,
  action text not null check (action in ('delete', 'warn', 'restrict', 'ban', 'approve')),
  severity integer not null default 1 check (severity between 1 and 10),
  enabled boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bot_audit_logs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.bot_groups(id) on delete cascade,
  actor_type text not null check (actor_type in ('admin', 'bot', 'system')),
  actor_id text,
  action text not null,
  resource_type text not null,
  resource_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists bot_members_group_user_idx on public.bot_members (group_id, telegram_user_id);
create index if not exists bot_blacklist_lookup_idx on public.bot_blacklist_items (group_id, item_type, normalized_value);
create index if not exists bot_moderation_rules_idx on public.bot_moderation_rules (group_id, enabled, priority);
create index if not exists bot_member_events_idx on public.bot_member_events (group_id, created_at desc);
create index if not exists bot_audit_logs_idx on public.bot_audit_logs (group_id, created_at desc);

create or replace function public.set_bot_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists bot_groups_updated_at on public.bot_groups;
create trigger bot_groups_updated_at before update on public.bot_groups for each row execute function public.set_bot_updated_at();

drop trigger if exists bot_group_settings_updated_at on public.bot_group_settings;
create trigger bot_group_settings_updated_at before update on public.bot_group_settings for each row execute function public.set_bot_updated_at();

drop trigger if exists bot_members_updated_at on public.bot_members;
create trigger bot_members_updated_at before update on public.bot_members for each row execute function public.set_bot_updated_at();

drop trigger if exists bot_blacklist_items_updated_at on public.bot_blacklist_items;
create trigger bot_blacklist_items_updated_at before update on public.bot_blacklist_items for each row execute function public.set_bot_updated_at();

drop trigger if exists bot_welcome_messages_updated_at on public.bot_welcome_messages;
create trigger bot_welcome_messages_updated_at before update on public.bot_welcome_messages for each row execute function public.set_bot_updated_at();

drop trigger if exists bot_moderation_rules_updated_at on public.bot_moderation_rules;
create trigger bot_moderation_rules_updated_at before update on public.bot_moderation_rules for each row execute function public.set_bot_updated_at();

