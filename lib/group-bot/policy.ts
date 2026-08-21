import { createServerSupabaseClient } from '@/lib/supabase/server';
import { detectMessageSignals, normalizeIdentifier, normalizeValue } from '@/lib/group-bot/normalize';
import { getCachedValue, invalidateCachedValue, setCachedValue } from '@/lib/group-bot/cache';

const POLICY_CACHE_TTL_MS = Number(process.env.GROUP_BOT_POLICY_CACHE_TTL_MS ?? 15000);

type GroupRow = {
  id: string;
  telegram_chat_id: string;
  title: string;
  username: string | null;
  status: string;
};

type GroupSettingsRow = {
  moderation_enabled: boolean;
  welcome_enabled: boolean;
  join_gate_enabled: boolean;
  delete_link_enabled: boolean;
  delete_keyword_enabled: boolean;
  auto_restrict_enabled: boolean;
  config_json: Record<string, unknown>;
};

type RuleRow = {
  id: string;
  enabled: boolean;
  rule_type: string;
  pattern: string;
  action: 'delete' | 'warn' | 'restrict' | 'ban' | 'approve';
  severity: number;
};

type BlacklistRow = {
  item_type: string;
  item_value: string;
};

type WelcomeRow = {
  message_text: string;
};

export type GroupPolicy = {
  group: GroupRow;
  settings: GroupSettingsRow;
  rules: RuleRow[];
  blacklist: BlacklistRow[];
  welcomes: WelcomeRow[];
};

export type ModerationDecision = {
  action: 'ignore' | 'allow' | 'delete' | 'warn' | 'restrict' | 'ban' | 'approve';
  reason: string;
  matched_rules: string[];
  matched_blacklist: string[];
  signals: {
    normalized: string;
    hasLink: boolean;
    hasPhone: boolean;
    mentions: number;
  };
  severity: number;
};

export async function loadGroupPolicy(chatId: string): Promise<GroupPolicy | null> {
  const cacheKey = `policy:${chatId}`;
  const cached = getCachedValue<GroupPolicy | null>(cacheKey);
  if (cached) return cached;
  const supabase = createServerSupabaseClient();
  const { data: group } = await supabase.from('bot_groups').select('id, telegram_chat_id, title, username, status').eq('telegram_chat_id', chatId).maybeSingle();
  if (!group) return null;

  const [settings, rules, blacklist, welcomes] = await Promise.all([
    supabase.from('bot_group_settings').select('*').eq('group_id', group.id).maybeSingle(),
    supabase.from('bot_moderation_rules').select('*').eq('group_id', group.id).eq('enabled', true).order('priority', { ascending: true }),
    supabase.from('bot_blacklist_items').select('*').or(`group_id.eq.${group.id},group_id.is.null`).eq('status', 'active'),
    supabase.from('bot_welcome_messages').select('*').eq('group_id', group.id).eq('enabled', true).order('created_at', { ascending: true }),
  ]);

  const policy = {
    group,
    settings: settings.data ?? {
      moderation_enabled: true,
      welcome_enabled: true,
      join_gate_enabled: false,
      delete_link_enabled: true,
      delete_keyword_enabled: true,
      auto_restrict_enabled: false,
      config_json: {},
    },
    rules: (rules.data ?? []) as RuleRow[],
    blacklist: (blacklist.data ?? []) as BlacklistRow[],
    welcomes: (welcomes.data ?? []) as WelcomeRow[],
  } satisfies GroupPolicy;
  setCachedValue(cacheKey, policy, POLICY_CACHE_TTL_MS);
  return policy;
}

export function invalidateGroupPolicy(chatId: string) {
  invalidateCachedValue(`policy:${chatId}`);
}

export function evaluateModerationDecision(policy: GroupPolicy | null, text: string, userId: string, username?: string | null): ModerationDecision {
  const signals = detectMessageSignals(text);
  if (!policy) {
    return { action: 'ignore', reason: 'policy_missing', matched_rules: [], matched_blacklist: [], signals, severity: 0 };
  }
  const { settings, rules, blacklist } = policy;
  const { normalized, hasLink, hasPhone, mentions } = signals;
  const matched_rules: string[] = [];
  const matched_blacklist: string[] = [];

  const userHit = blacklist.find((item) => item.item_type === 'user_id' && normalizeIdentifier(item.item_value) === normalizeIdentifier(userId));
  if (userHit) {
    matched_blacklist.push(`user_id:${userHit.item_value}`);
    return { action: 'ban', reason: `blacklist:user_id:${userHit.item_value}`, matched_rules, matched_blacklist, signals, severity: 10 };
  }

  if (username) {
    const usernameHit = blacklist.find((item) => item.item_type === 'username' && normalizeValue(item.item_value) === normalizeValue(username));
    if (usernameHit) {
      matched_blacklist.push(`username:${usernameHit.item_value}`);
      return { action: 'ban', reason: `blacklist:username:${usernameHit.item_value}`, matched_rules, matched_blacklist, signals, severity: 10 };
    }
  }

  const keywordHit = blacklist.find((item) => ['keyword', 'phrase'].includes(item.item_type) && normalized.includes(normalizeValue(item.item_value)));
  if (keywordHit) {
    matched_blacklist.push(`${keywordHit.item_type}:${keywordHit.item_value}`);
    return { action: 'delete', reason: `blacklist:${keywordHit.item_type}:${keywordHit.item_value}`, matched_rules, matched_blacklist, signals, severity: 7 };
  }

  if (settings.delete_link_enabled && hasLink) {
    return { action: 'delete', reason: 'link_detected', matched_rules, matched_blacklist, signals, severity: 4 };
  }
  if (settings.delete_keyword_enabled && hasPhone) {
    return { action: 'delete', reason: 'phone_detected', matched_rules, matched_blacklist, signals, severity: 4 };
  }

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if ((rule.rule_type === 'keyword' || rule.rule_type === 'repeated_text') && normalized.includes(normalizeValue(rule.pattern))) {
      matched_rules.push(rule.id);
      return { action: rule.action, reason: `rule:${rule.id}`, matched_rules, matched_blacklist, signals, severity: rule.severity };
    }
    if (rule.rule_type === 'link' && hasLink) {
      matched_rules.push(rule.id);
      return { action: rule.action, reason: `rule:${rule.id}`, matched_rules, matched_blacklist, signals, severity: rule.severity };
    }
    if (rule.rule_type === 'mention' && mentions > Number(rule.pattern || 0)) {
      matched_rules.push(rule.id);
      return { action: rule.action, reason: `rule:${rule.id}`, matched_rules, matched_blacklist, signals, severity: rule.severity };
    }
  }

  return { action: 'allow', reason: 'no_match', matched_rules, matched_blacklist, signals, severity: 0 };
}
