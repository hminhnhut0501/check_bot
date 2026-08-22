import { createServerSupabaseClient } from '@/lib/supabase/server';
import { invalidateGroupPolicy } from '@/lib/group-bot/policy';

export type AuditPayload = {
  group_id: string | null;
  actor_type: 'admin' | 'bot' | 'system';
  actor_id?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  old_data?: unknown;
  new_data?: unknown;
};

export type AuditEventFamily = 'group' | 'settings' | 'rule' | 'member' | 'blacklist' | 'welcome' | 'system';

export function classifyAuditEvent(action: string, resourceType: string): { family: AuditEventFamily; kind: string; retentionDays: number } {
  if (resourceType === 'group') return { family: 'group', kind: action, retentionDays: 365 };
  if (resourceType === 'moderation_rule') return { family: 'rule', kind: action, retentionDays: 365 };
  if (resourceType === 'blacklist_item') return { family: 'blacklist', kind: action, retentionDays: 365 };
  if (resourceType === 'welcome_message') return { family: 'welcome', kind: action, retentionDays: 365 };
  if (resourceType === 'member') return { family: 'member', kind: action, retentionDays: 180 };
  if (action.startsWith('group.') || action.startsWith('settings.')) return { family: 'settings', kind: action, retentionDays: 365 };
  if (action.startsWith('member.')) return { family: 'member', kind: action, retentionDays: 180 };
  if (action.startsWith('rule.')) return { family: 'rule', kind: action, retentionDays: 365 };
  if (action.startsWith('blacklist.')) return { family: 'blacklist', kind: action, retentionDays: 365 };
  if (action.startsWith('welcome.')) return { family: 'welcome', kind: action, retentionDays: 365 };
  return { family: 'system', kind: action, retentionDays: 365 };
}

export function normalizeGroupBotValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function fetchGroupAdminBundle(groupId: string) {
  const supabase = createServerSupabaseClient();
  const [group, settings, members, rules, audit, blacklist, welcome, memberEvents] = await Promise.all([
    supabase.from('bot_groups').select('*').eq('id', groupId).maybeSingle(),
    supabase.from('bot_group_settings').select('*').eq('group_id', groupId).maybeSingle(),
    supabase.from('bot_members').select('*').eq('group_id', groupId).order('last_seen_at', { ascending: false }).limit(100),
    supabase.from('bot_moderation_rules').select('*').eq('group_id', groupId).order('priority', { ascending: true }),
    supabase.from('bot_audit_logs').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(100),
    supabase.from('bot_blacklist_items').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(100),
    supabase.from('bot_welcome_messages').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(100),
    supabase.from('bot_member_events').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(100),
  ]);
  return { supabase, group, settings, members, rules, audit, blacklist, welcome, memberEvents };
}

export async function getGroupChatId(groupId: string) {
  const supabase = createServerSupabaseClient();
  return supabase.from('bot_groups').select('telegram_chat_id').eq('id', groupId).maybeSingle();
}

export async function logAudit(payload: AuditPayload) {
  const supabase = createServerSupabaseClient();
  const classification = classifyAuditEvent(payload.action, payload.resource_type);
  return supabase.from('bot_audit_logs').insert({
    ...payload,
    event_family: classification.family,
    event_kind: classification.kind,
    retention_days: classification.retentionDays,
    expires_at: new Date(Date.now() + classification.retentionDays * 24 * 60 * 60 * 1000).toISOString(),
  });
}

export async function listGroups() {
  const supabase = createServerSupabaseClient();
  return supabase.from('bot_groups').select('*, bot_group_settings(*)').order('created_at', { ascending: false });
}

export async function createGroup(input: { telegram_chat_id: string; title: string; username?: string | null }) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('bot_groups')
    .insert({
      telegram_chat_id: input.telegram_chat_id,
      title: input.title,
      username: input.username ?? null,
    })
    .select('*')
    .single();
  if (error) return { data: null, error };
  const settings = await supabase.from('bot_group_settings').insert({ group_id: data.id });
  invalidateGroupPolicy(data.telegram_chat_id);
  return { data, error: settings.error };
}

export async function updateGroup(groupId: string, input: { title?: string; username?: string | null; status?: string; settings?: Record<string, unknown>; updatedBy?: string | null }) {
  const supabase = createServerSupabaseClient();
  if (input.title !== undefined || input.username !== undefined || input.status !== undefined) {
    const update: Record<string, string | null> = {};
    if (input.title !== undefined) update.title = input.title;
    if (input.username !== undefined) update.username = input.username;
    if (input.status !== undefined) update.status = input.status;
    const { error } = await supabase.from('bot_groups').update(update).eq('id', groupId);
    if (error) return { error };
  }

  if (input.settings) {
    const settings = input.settings;
    const { error } = await supabase.from('bot_group_settings').upsert({
      group_id: groupId,
      moderation_enabled: settings.moderation_enabled ?? true,
      welcome_enabled: settings.welcome_enabled ?? true,
      join_gate_enabled: settings.join_gate_enabled ?? false,
      delete_link_enabled: settings.delete_link_enabled ?? true,
      delete_keyword_enabled: settings.delete_keyword_enabled ?? true,
      auto_restrict_enabled: settings.auto_restrict_enabled ?? false,
      config_json: settings.config_json ?? {},
      updated_by: input.updatedBy ?? null,
    });
    if (error) return { error };
  }

  const { data, error } = await supabase.from('bot_groups').select('*, bot_group_settings(*)').eq('id', groupId).single();
  if (data?.telegram_chat_id) invalidateGroupPolicy(data.telegram_chat_id);
  return { data, error };
}

export async function removeGroup(groupId: string) {
  const supabase = createServerSupabaseClient();
  const existing = await supabase.from('bot_groups').select('telegram_chat_id').eq('id', groupId).maybeSingle();
  const result = await supabase.from('bot_groups').update({ status: 'removed' }).eq('id', groupId);
  if (existing.data?.telegram_chat_id) invalidateGroupPolicy(existing.data.telegram_chat_id);
  return result;
}

export async function listRules(groupId: string) {
  const supabase = createServerSupabaseClient();
  return supabase.from('bot_moderation_rules').select('*').eq('group_id', groupId).order('priority', { ascending: true });
}

export async function createRule(input: Record<string, unknown>) {
  const supabase = createServerSupabaseClient();
  return supabase.from('bot_moderation_rules').insert(input).select('*').single();
}

export async function updateRule(id: string, update: Record<string, unknown>) {
  const supabase = createServerSupabaseClient();
  return supabase.from('bot_moderation_rules').update(update).eq('id', id).select('*').single();
}

export async function deleteRule(id: string) {
  const supabase = createServerSupabaseClient();
  const existing = await supabase.from('bot_moderation_rules').select('*').eq('id', id).maybeSingle();
  if (!existing.data) return { existing: null, error: null };
  const deleted = await supabase.from('bot_moderation_rules').delete().eq('id', id);
  return { existing: existing.data, error: deleted.error };
}

export async function listBlacklist(groupId?: string | null) {
  const supabase = createServerSupabaseClient();
  let query = supabase.from('bot_blacklist_items').select('*').order('created_at', { ascending: false });
  if (groupId) query = query.eq('group_id', groupId);
  return query;
}

export async function createBlacklistItem(input: Record<string, unknown>) {
  const supabase = createServerSupabaseClient();
  return supabase.from('bot_blacklist_items').insert(input).select('*').single();
}

export async function updateBlacklistItem(id: string, update: Record<string, unknown>) {
  const supabase = createServerSupabaseClient();
  return supabase.from('bot_blacklist_items').update(update).eq('id', id).select('*').single();
}

export async function deleteBlacklistItem(id: string) {
  const supabase = createServerSupabaseClient();
  const existing = await supabase.from('bot_blacklist_items').select('*').eq('id', id).maybeSingle();
  if (!existing.data) return { existing: null, error: null };
  const deleted = await supabase.from('bot_blacklist_items').delete().eq('id', id);
  return { existing: existing.data, error: deleted.error };
}

export async function listWelcomeMessages(groupId: string) {
  const supabase = createServerSupabaseClient();
  return supabase.from('bot_welcome_messages').select('*').eq('group_id', groupId).order('created_at', { ascending: false });
}

export async function createWelcomeMessage(input: Record<string, unknown>) {
  const supabase = createServerSupabaseClient();
  return supabase.from('bot_welcome_messages').insert(input).select('*').single();
}

export async function updateWelcomeMessage(id: string, update: Record<string, unknown>) {
  const supabase = createServerSupabaseClient();
  return supabase.from('bot_welcome_messages').update(update).eq('id', id).select('*').single();
}

export async function deleteWelcomeMessage(id: string) {
  const supabase = createServerSupabaseClient();
  const existing = await supabase.from('bot_welcome_messages').select('*').eq('id', id).maybeSingle();
  if (!existing.data) return { existing: null, error: null };
  const deleted = await supabase.from('bot_welcome_messages').delete().eq('id', id);
  return { existing: existing.data, error: deleted.error };
}

export async function listMembers(groupId: string) {
  const supabase = createServerSupabaseClient();
  return supabase.from('bot_members').select('*').eq('group_id', groupId).order('last_seen_at', { ascending: false }).limit(200);
}

export async function getMemberBundle(groupId: string, userId: string) {
  const supabase = createServerSupabaseClient();
  const [member, events, audit] = await Promise.all([
    supabase.from('bot_members').select('*').eq('group_id', groupId).eq('telegram_user_id', userId).maybeSingle(),
    supabase.from('bot_member_events').select('*').eq('group_id', groupId).eq('telegram_user_id', userId).order('created_at', { ascending: false }).limit(50),
    supabase.from('bot_audit_logs').select('*').eq('group_id', groupId).eq('resource_type', 'member').eq('resource_id', userId).order('created_at', { ascending: false }).limit(50),
  ]);
  return { member, events, audit };
}

export async function updateMemberStatus(groupId: string, userId: string, status: string) {
  const supabase = createServerSupabaseClient();
  return supabase.from('bot_members').update({ status, left_at: status === 'banned' ? new Date().toISOString() : null }).eq('group_id', groupId).eq('telegram_user_id', userId).select('*').single();
}

export async function upsertMemberSnapshot(groupId: string, userId: string, snapshot: Record<string, unknown>) {
  const supabase = createServerSupabaseClient();
  return supabase.from('bot_members').upsert({
    group_id: groupId,
    telegram_user_id: userId,
    ...snapshot,
  }, { onConflict: 'group_id,telegram_user_id' }).select('*').single();
}

export async function recordMemberEvent(groupId: string, userId: string, eventType: string, payloadJson: Record<string, unknown>) {
  const supabase = createServerSupabaseClient();
  return supabase.from('bot_member_events').insert({
    group_id: groupId,
    telegram_user_id: userId,
    event_type: eventType,
    payload_json: payloadJson,
  });
}

export async function listAudit(groupId: string) {
  const supabase = createServerSupabaseClient();
  return supabase.from('bot_audit_logs').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(200);
}

export async function summarizeAudit(
  groupId: string,
  sinceAt: string,
  filters?: { action?: string | null; resourceType?: string | null; actorType?: string | null },
) {
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from('bot_audit_logs')
    .select('action, resource_type, actor_type, created_at, new_data, event_family, event_kind')
    .eq('group_id', groupId)
    .gte('created_at', sinceAt)
    .order('created_at', { ascending: false })
    .limit(500);
  if (filters?.action) query = query.eq('action', filters.action);
  if (filters?.resourceType) query = query.eq('resource_type', filters.resourceType);
  if (filters?.actorType) query = query.eq('actor_type', filters.actorType);
  const { data, error } = await query;

  if (error) return { data: null, error };

  const topActions: Record<string, number> = {};
  const topResources: Record<string, number> = {};
  const topActors: Record<string, number> = {};
  const topFamilies: Record<string, number> = {};
  const topKinds: Record<string, number> = {};

  for (const row of data ?? []) {
    topActions[row.action] = (topActions[row.action] ?? 0) + 1;
    topResources[row.resource_type] = (topResources[row.resource_type] ?? 0) + 1;
    topActors[row.actor_type] = (topActors[row.actor_type] ?? 0) + 1;
    topFamilies[row.event_family ?? 'system'] = (topFamilies[row.event_family ?? 'system'] ?? 0) + 1;
    topKinds[row.event_kind ?? row.action] = (topKinds[row.event_kind ?? row.action] ?? 0) + 1;
  }

  return {
    data: {
      count: data?.length ?? 0,
      families: Object.entries(topFamilies).map(([family, count]) => ({ family, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      kinds: Object.entries(topKinds).map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      top_actions: Object.entries(topActions).map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      top_resources: Object.entries(topResources).map(([resource_type, count]) => ({ resource_type, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      top_actors: Object.entries(topActors).map(([actor_type, count]) => ({ actor_type, count })).sort((a, b) => b.count - a.count).slice(0, 5),
    },
    error: null,
  };
}
