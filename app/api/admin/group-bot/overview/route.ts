import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';

type DailyRow = { actions: number; joins: number; bans: number; restricts: number; deletes: number; warnings: number };

export async function GET(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id') ?? '';
  const sinceHours = Math.max(1, Math.min(Number(url.searchParams.get('since_hours') ?? 24), 168));
  const sinceAt = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  const trendSinceAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createServerSupabaseClient();

  let groupsQuery = supabase
    .from('bot_groups')
    .select('id, telegram_chat_id, title, username, status, bot_group_settings(*)')
    .order('created_at', { ascending: false });
  if (groupId) groupsQuery = groupsQuery.eq('id', groupId);

  const { data: groups, error: groupsError } = await groupsQuery;
  if (groupsError) return NextResponse.json({ error: groupsError.message }, { status: 500 });

  const groupIds = (groups ?? []).map((group) => group.id);
  if (!groupIds.length) {
    return NextResponse.json({ overview: [] });
  }

  const [membersResult, rulesResult, auditResult, blacklistResult, welcomeResult, memberEventsResult] = await Promise.all([
    supabase.from('bot_members').select('group_id, status').in('group_id', groupIds),
    supabase.from('bot_moderation_rules').select('group_id, enabled').in('group_id', groupIds),
    supabase.from('bot_audit_logs').select('group_id, created_at, action, new_data').in('group_id', groupIds).gte('created_at', sinceAt),
    supabase.from('bot_blacklist_items').select('group_id, status').in('group_id', groupIds),
    supabase.from('bot_welcome_messages').select('group_id, enabled').in('group_id', groupIds),
    supabase.from('bot_member_events').select('group_id, telegram_user_id, event_type, created_at').in('group_id', groupIds).gte('created_at', trendSinceAt),
  ]);

  const firstError = membersResult.error ?? rulesResult.error ?? auditResult.error ?? blacklistResult.error ?? welcomeResult.error ?? memberEventsResult.error;
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

  const members = membersResult.data ?? [];
  const rules = rulesResult.data ?? [];
  const audit = auditResult.data ?? [];
  const blacklist = blacklistResult.data ?? [];
  const welcome = welcomeResult.data ?? [];
  const memberEvents = memberEventsResult.data ?? [];

  const membersByGroup = new Map(groupIds.map((id) => [id, [] as typeof members]));
  const rulesByGroup = new Map(groupIds.map((id) => [id, [] as typeof rules]));
  const auditByGroup = new Map(groupIds.map((id) => [id, [] as typeof audit]));
  const blacklistByGroup = new Map(groupIds.map((id) => [id, [] as typeof blacklist]));
  const welcomeByGroup = new Map(groupIds.map((id) => [id, [] as typeof welcome]));

  for (const item of members) membersByGroup.get(item.group_id)?.push(item);
  for (const item of rules) rulesByGroup.get(item.group_id)?.push(item);
  for (const item of audit) auditByGroup.get(item.group_id)?.push(item);
  for (const item of blacklist) blacklistByGroup.get(item.group_id)?.push(item);
  for (const item of welcome) welcomeByGroup.get(item.group_id)?.push(item);

  const daily: Record<string, DailyRow> = {};
  const days: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    days.push(day);
    daily[day] = { actions: 0, joins: 0, bans: 0, restricts: 0, deletes: 0, warnings: 0 };
  }

  const topActions: Record<string, number> = {};
  const topRuleHits: Record<string, number> = {};
  const topGroups: Record<string, number> = {};
  const actionBreakdown: Record<string, number> = {};

  for (const auditItem of audit) {
    const day = auditItem.created_at.slice(0, 10);
    if (daily[day]) daily[day].actions += 1;
    actionBreakdown[auditItem.action] = (actionBreakdown[auditItem.action] ?? 0) + 1;
    topGroups[auditItem.group_id] = (topGroups[auditItem.group_id] ?? 0) + 1;
    const reason = typeof auditItem.new_data?.reason === 'string' ? auditItem.new_data.reason : '';
    if (reason.startsWith('rule:')) {
      const ruleId = reason.slice('rule:'.length);
      topRuleHits[ruleId] = (topRuleHits[ruleId] ?? 0) + 1;
    }
    if (daily[day]) {
      if (auditItem.action === 'ban') daily[day].bans += 1;
      if (auditItem.action === 'restrict') daily[day].restricts += 1;
      if (auditItem.action === 'message_deleted') daily[day].deletes += 1;
      if (auditItem.action === 'warning') daily[day].warnings += 1;
    }
  }

  for (const memberEvent of memberEvents) {
    const day = memberEvent.created_at.slice(0, 10);
    if (daily[day]) {
      daily[day].actions += 1;
      if (memberEvent.event_type === 'join') daily[day].joins += 1;
    }
    topActions[`member.${memberEvent.event_type}`] = (topActions[`member.${memberEvent.event_type}`] ?? 0) + 1;
    topGroups[memberEvent.group_id] = (topGroups[memberEvent.group_id] ?? 0) + 1;
  }

  const overview = (groups ?? []).map((group) => {
    const groupMembers = membersByGroup.get(group.id) ?? [];
    const groupRules = rulesByGroup.get(group.id) ?? [];
    const groupAudit = auditByGroup.get(group.id) ?? [];
    const groupBlacklist = blacklistByGroup.get(group.id) ?? [];
    const groupWelcome = welcomeByGroup.get(group.id) ?? [];
    const lastActionAt = groupAudit[0]?.created_at ?? null;

    return {
      group,
      metrics: {
        member_count: groupMembers.length,
        active_member_count: groupMembers.filter((item) => item.status === 'member').length,
        restricted_member_count: groupMembers.filter((item) => item.status === 'restricted').length,
        banned_member_count: groupMembers.filter((item) => item.status === 'banned').length,
        rule_count: groupRules.length,
        enabled_rule_count: groupRules.filter((item) => item.enabled).length,
        action_count_24h: groupAudit.length,
        blacklist_count: groupBlacklist.filter((item) => item.status === 'active').length,
        welcome_count: groupWelcome.filter((item) => item.enabled).length,
        last_action_at: lastActionAt,
      },
    };
  });

  return NextResponse.json({
    since_hours: sinceHours,
    since_at: sinceAt,
    overview,
    trend: days.map((day) => ({ day, ...daily[day] })),
    top_actions: Object.entries(actionBreakdown).map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    top_rule_hits: Object.entries(topRuleHits).map(([rule_id, count]) => ({ rule_id, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    top_groups: Object.entries(topGroups).map(([group_id, count]) => ({ group_id, count })).sort((a, b) => b.count - a.count).slice(0, 10),
  });
}
