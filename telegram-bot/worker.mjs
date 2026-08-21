import { createClient } from '@supabase/supabase-js';

const token = process.env.TELEGRAM_BOT_TOKEN;
const apiBase = process.env.SCAMSHIELD_API_URL;
const internalSecret = process.env.INTERNAL_API_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!token || !apiBase || !internalSecret || !supabaseUrl || !supabaseKey) {
  throw new Error('TELEGRAM_BOT_TOKEN, SCAMSHIELD_API_URL, INTERNAL_API_SECRET, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const telegram = `https://api.telegram.org/bot${token}`;
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } });
let offset = 0;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callTelegram(method, body = {}, attempt = 0) {
  const response = await fetch(`${telegram}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok || !result?.ok) {
    const retryable = response.status >= 500 || response.status === 429;
    if (retryable && attempt < 2) {
      await delay(250 * 2 ** attempt);
      return callTelegram(method, body, attempt + 1);
    }
    throw new Error(result?.description ?? `Telegram ${method} failed`);
  }

  return result.result;
}

async function send(chatId, text) {
  await callTelegram('sendMessage', { chat_id: chatId, text });
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function detectSignals(text) {
  return {
    normalized: normalize(text),
    hasLink: /(https?:\/\/|t\.me\/|telegram\.me\/|www\.)/i.test(text),
    hasPhone: /(?:\+?\d[\d\s().-]{7,}\d)/.test(text),
    mentions: (text.match(/@\w+/g) ?? []).length,
  };
}

async function loadPolicy(chatId) {
  const { data: group } = await supabase.from('bot_groups').select('id, telegram_chat_id, title, username, status').eq('telegram_chat_id', String(chatId)).maybeSingle();
  if (!group || group.status !== 'active') return null;
  const [settings, rules, blacklist, welcomes] = await Promise.all([
    supabase.from('bot_group_settings').select('*').eq('group_id', group.id).maybeSingle(),
    supabase.from('bot_moderation_rules').select('*').eq('group_id', group.id).eq('enabled', true).order('priority', { ascending: true }),
    supabase.from('bot_blacklist_items').select('*').or(`group_id.eq.${group.id},group_id.is.null`).eq('status', 'active'),
    supabase.from('bot_welcome_messages').select('*').eq('group_id', group.id).eq('enabled', true).order('created_at', { ascending: true }),
  ]);
  return {
    group,
    settings: settings.data ?? { moderation_enabled: true, welcome_enabled: true, join_gate_enabled: false, delete_link_enabled: true, delete_keyword_enabled: true, auto_restrict_enabled: false },
    rules: rules.data ?? [],
    blacklist: blacklist.data ?? [],
    welcomes: welcomes.data ?? [],
  };
}

async function logEvent(groupId, actorType, action, resourceType, resourceId, payload = {}) {
  await supabase.from('bot_audit_logs').insert({ group_id: groupId, actor_type: actorType, action, resource_type: resourceType, resource_id: resourceId, new_data: payload });
}

async function upsertMember(groupId, message, status = 'member') {
  const userId = String(message.from?.id ?? '');
  if (!userId) return;
  await supabase.from('bot_members').upsert({
    group_id: groupId,
    telegram_user_id: userId,
    username: message.from?.username ?? null,
    display_name: [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || null,
    status,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'group_id,telegram_user_id' });
}

function evaluate(policy, text, userId, username) {
  const { settings, rules, blacklist } = policy;
  const { normalized, hasLink, hasPhone, mentions } = detectSignals(text);
  const userHit = blacklist.find((item) => item.item_type === 'user_id' && normalize(item.item_value) === normalize(userId));
  if (userHit) return { action: 'ban', reason: 'blacklist:user_id' };
  if (username) {
    const usernameHit = blacklist.find((item) => item.item_type === 'username' && normalize(item.item_value) === normalize(username));
    if (usernameHit) return { action: 'ban', reason: 'blacklist:username' };
  }
  const keywordHit = blacklist.find((item) => ['keyword', 'phrase'].includes(item.item_type) && normalized.includes(normalize(item.item_value)));
  if (keywordHit) return { action: 'delete', reason: 'blacklist:keyword' };
  if (settings.delete_link_enabled && hasLink) return { action: 'delete', reason: 'link_detected' };
  if (settings.delete_keyword_enabled && hasPhone) return { action: 'delete', reason: 'phone_detected' };
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if ((rule.rule_type === 'keyword' || rule.rule_type === 'repeated_text') && normalized.includes(normalize(rule.pattern))) return { action: rule.action, reason: `rule:${rule.id}` };
    if (rule.rule_type === 'link' && hasLink) return { action: rule.action, reason: `rule:${rule.id}` };
    if (rule.rule_type === 'mention' && mentions > Number(rule.pattern || 0)) return { action: rule.action, reason: `rule:${rule.id}` };
  }
  return { action: 'allow' };
}

async function handleGroupMessage(message) {
  const policy = await loadPolicy(message.chat.id);
  if (!policy) return;
  const text = (message.text ?? '').trim();
  if (message.new_chat_members?.length) {
    for (const member of message.new_chat_members) {
      await upsertMember(policy.group.id, { from: member }, 'member');
      await logEvent(policy.group.id, 'bot', 'join', 'member', String(member.id), { username: member.username ?? null });
      if (policy.settings.welcome_enabled && policy.welcomes.length) {
        const welcome = policy.welcomes[0].message_text.replaceAll('{name}', [member.first_name, member.last_name].filter(Boolean).join(' ') || member.username || 'bạn').replaceAll('{group}', message.chat.title ?? 'group');
        await send(message.chat.id, welcome);
      }
    }
  }
  if (!text) return;
  const username = message.from?.username ? `@${message.from.username}` : null;
  await upsertMember(policy.group.id, message, 'member');
  const decision = evaluate(policy, text, String(message.from?.id ?? ''), username);
  if (decision.action === 'allow') return;
  if (decision.action === 'delete' || decision.action === 'warn' || decision.action === 'restrict' || decision.action === 'ban') {
    await callTelegram('deleteMessage', { chat_id: message.chat.id, message_id: message.message_id }).catch(() => null);
    await logEvent(policy.group.id, 'bot', 'message_deleted', 'message', String(message.message_id), { reason: decision.reason, userId: String(message.from?.id ?? '') });
  }
  if (decision.action === 'warn') await send(message.chat.id, 'Cảnh báo: nội dung bị gắn cờ bởi rule group.');
  if (decision.action === 'restrict') {
    await callTelegram('restrictChatMember', { chat_id: message.chat.id, user_id: Number(message.from?.id ?? 0), permissions: { can_send_messages: false, can_send_audios: false, can_send_documents: false, can_send_photos: false, can_send_videos: false, can_send_video_notes: false, can_send_voice_notes: false, can_send_polls: false, can_send_other_messages: false, can_add_web_page_previews: false } }).catch(() => null);
    await logEvent(policy.group.id, 'bot', 'restrict', 'member', String(message.from?.id ?? ''), { reason: decision.reason });
  }
  if (decision.action === 'ban') {
    await callTelegram('banChatMember', { chat_id: message.chat.id, user_id: Number(message.from?.id ?? 0) }).catch(() => null);
    await logEvent(policy.group.id, 'bot', 'ban', 'member', String(message.from?.id ?? ''), { reason: decision.reason });
  }
}

async function handleUpdate(update) {
  if (update.message) await handleGroupMessage(update.message);
  if (update.my_chat_member) {
    const chat = update.my_chat_member.chat;
    const policy = await loadPolicy(chat.id);
    if (!policy) return;
    const newStatus = update.my_chat_member.new_chat_member?.status ?? 'member';
    await logEvent(policy.group.id, 'bot', 'member_status', 'group', String(chat.id), { status: newStatus });
  }
}

async function poll() {
  const updates = await callTelegram('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'my_chat_member'] });
  for (const update of updates) {
    offset = update.update_id + 1;
    await handleUpdate(update);
  }
}

async function heartbeat() {
  await fetch(`${apiBase}/api/internal/group-bot/ping`, { method: 'POST', headers: { 'x-internal-secret': internalSecret } }).catch(() => null);
}

while (true) {
  try {
    await poll();
    await heartbeat();
  } catch (error) {
    console.error(error);
    await delay(3000);
  }
}
