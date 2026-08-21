-- Phase 14 seed: local development data for the group-bot dashboard.

with seeded_group as (
  insert into public.bot_groups (telegram_chat_id, title, username, status)
  values ('-1001234567890', 'Cú Bot Demo Group', 'cubot_demo', 'active')
  on conflict (telegram_chat_id) do update
    set title = excluded.title,
        username = excluded.username,
        status = excluded.status
  returning id
)
insert into public.bot_group_settings (
  group_id, moderation_enabled, welcome_enabled, join_gate_enabled, delete_link_enabled, delete_keyword_enabled, auto_restrict_enabled, config_json
)
select
  id, true, true, false, true, true, false, '{"mode":"standard","seed":"local-dev"}'::jsonb
from seeded_group
on conflict (group_id) do update
  set moderation_enabled = excluded.moderation_enabled,
      welcome_enabled = excluded.welcome_enabled,
      join_gate_enabled = excluded.join_gate_enabled,
      delete_link_enabled = excluded.delete_link_enabled,
      delete_keyword_enabled = excluded.delete_keyword_enabled,
      auto_restrict_enabled = excluded.auto_restrict_enabled,
      config_json = excluded.config_json;

insert into public.bot_moderation_rules (
  group_id, rule_type, pattern, action, severity, enabled, priority
) select
  id, 'keyword', 'demo spam', 'delete', 3, true, 10
from public.bot_groups
where telegram_chat_id = '-1001234567890'
  and not exists (
    select 1
    from public.bot_moderation_rules rules
    where rules.group_id = public.bot_groups.id
      and rules.rule_type = 'keyword'
      and rules.pattern = 'demo spam'
  );

insert into public.bot_welcome_messages (
  group_id, variant_name, message_text, enabled, conditions_json
) select
  id, 'default', 'Chào mừng bạn đến với Cú Bot Demo Group. Hãy đọc nội quy trước khi nhắn tin.', true, '{"audience":"new_member"}'::jsonb
from public.bot_groups
where telegram_chat_id = '-1001234567890'
  and not exists (
    select 1
    from public.bot_welcome_messages welcome
    where welcome.group_id = public.bot_groups.id
      and welcome.variant_name = 'default'
  );
