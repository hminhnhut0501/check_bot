import { spawn } from 'node:child_process';

const databaseUrl = process.env.SUPABASE_DB_URL;
if (!databaseUrl) throw new Error('SUPABASE_DB_URL is required');

const query = `
select
  to_regclass('public.bot_groups') as bot_groups,
  to_regclass('public.bot_group_settings') as bot_group_settings,
  to_regclass('public.bot_members') as bot_members,
  to_regclass('public.bot_member_events') as bot_member_events,
  to_regclass('public.bot_blacklist_items') as bot_blacklist_items,
  to_regclass('public.bot_welcome_messages') as bot_welcome_messages,
  to_regclass('public.bot_moderation_rules') as bot_moderation_rules,
  to_regclass('public.bot_audit_logs') as bot_audit_logs,
  to_regclass('public.bot_schema_versions') as bot_schema_versions;
`;

const child = spawn('psql', ['--no-psqlrc', databaseUrl, '-c', query], { stdio: 'inherit' });

child.on('exit', (code) => process.exit(code ?? 1));
