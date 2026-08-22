import { createClient } from '@supabase/supabase-js';

const token = process.env.TELEGRAM_BOT_TOKEN;
const apiBase = process.env.SCAMSHIELD_API_URL;
const internalSecret = process.env.INTERNAL_API_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workerId = process.env.GROUP_BOT_WORKER_ID || `group-bot-worker-${process.pid}`;
const pollTimeoutMs = Number(process.env.GROUP_BOT_POLL_TIMEOUT_MS ?? 25_000);
const pollIdleDelayMs = Number(process.env.GROUP_BOT_IDLE_DELAY_MS ?? 1_000);
const errorBackoffMaxMs = Number(process.env.GROUP_BOT_ERROR_BACKOFF_MAX_MS ?? 15_000);
const heartbeatEveryMs = Number(process.env.GROUP_BOT_HEARTBEAT_EVERY_MS ?? 60_000);
const queueEveryPoll = String(process.env.GROUP_BOT_QUEUE_ENABLED ?? 'true') !== 'false';

if (!token || !apiBase || !internalSecret || !supabaseUrl || !supabaseKey) {
  throw new Error('TELEGRAM_BOT_TOKEN, SCAMSHIELD_API_URL, INTERNAL_API_SECRET, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const telegram = `https://api.telegram.org/bot${token}`;
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } });

const metrics = {
  startedAt: new Date().toISOString(),
  polls: 0,
  updates: 0,
  queueJobs: 0,
  queueSuccess: 0,
  queueFailure: 0,
  telegramCalls: 0,
  telegramFailures: 0,
  actions: { delete: 0, warn: 0, restrict: 0, ban: 0, welcome: 0, join: 0 },
  lastErrorAt: null,
  lastHeartbeatAt: null,
  lastPollAt: null,
  lastUpdateAt: null,
  lastQueueAt: null,
};

let offset = 0;
let backoffMs = 0;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(level, event, payload = {}) {
  console.log(JSON.stringify({ level, event, workerId, at: new Date().toISOString(), ...payload }));
}

function recordError(error, context) {
  metrics.lastErrorAt = new Date().toISOString();
  log('error', context, { message: error?.message ?? String(error), stack: error?.stack ?? null });
}

async function callTelegram(method, body = {}, attempt = 0) {
  metrics.telegramCalls += 1;
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
    metrics.telegramFailures += 1;
    const retryable = response.status >= 500 || response.status === 429;
    if (retryable && attempt < 3) {
      const waitMs = Math.min(errorBackoffMaxMs, 250 * 2 ** attempt);
      log('warn', 'telegram.retry', { method, attempt: attempt + 1, waitMs, status: response.status });
      await delay(waitMs);
      return callTelegram(method, body, attempt + 1);
    }
    throw new Error(result?.description ?? `Telegram ${method} failed`);
  }

  return result.result;
}

async function send(chatId, text) {
  metrics.actions.welcome += 1;
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
  await supabase.from('bot_audit_logs').insert({
    group_id: groupId,
    actor_type: actorType,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    new_data: payload,
  });
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
  if (userHit) return { action: 'ban', reason: 'blacklist:user_id', signals: { normalized, hasLink, hasPhone, mentions } };
  if (username) {
    const usernameHit = blacklist.find((item) => item.item_type === 'username' && normalize(item.item_value) === normalize(username));
    if (usernameHit) return { action: 'ban', reason: 'blacklist:username', signals: { normalized, hasLink, hasPhone, mentions } };
  }
  const keywordHit = blacklist.find((item) => ['keyword', 'phrase'].includes(item.item_type) && normalized.includes(normalize(item.item_value)));
  if (keywordHit) return { action: 'delete', reason: 'blacklist:keyword', signals: { normalized, hasLink, hasPhone, mentions } };
  if (settings.delete_link_enabled && hasLink) return { action: 'delete', reason: 'link_detected', signals: { normalized, hasLink, hasPhone, mentions } };
  if (settings.delete_keyword_enabled && hasPhone) return { action: 'delete', reason: 'phone_detected', signals: { normalized, hasLink, hasPhone, mentions } };
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if ((rule.rule_type === 'keyword' || rule.rule_type === 'repeated_text') && normalized.includes(normalize(rule.pattern))) return { action: rule.action, reason: `rule:${rule.id}`, signals: { normalized, hasLink, hasPhone, mentions } };
    if (rule.rule_type === 'link' && hasLink) return { action: rule.action, reason: `rule:${rule.id}`, signals: { normalized, hasLink, hasPhone, mentions } };
    if (rule.rule_type === 'mention' && mentions > Number(rule.pattern || 0)) return { action: rule.action, reason: `rule:${rule.id}`, signals: { normalized, hasLink, hasPhone, mentions } };
  }
  return { action: 'allow', signals: { normalized, hasLink, hasPhone, mentions } };
}

async function handleGroupMessage(message) {
  const policy = await loadPolicy(message.chat.id);
  if (!policy) return;
  const text = (message.text ?? '').trim();
  if (message.new_chat_members?.length) {
    for (const member of message.new_chat_members) {
      metrics.actions.join += 1;
      await upsertMember(policy.group.id, { from: member }, 'member');
      await logEvent(policy.group.id, 'bot', 'join', 'member', String(member.id), { username: member.username ?? null });
      if (policy.settings.welcome_enabled && policy.welcomes.length) {
        const welcome = policy.welcomes[0].message_text
          .replaceAll('{name}', [member.first_name, member.last_name].filter(Boolean).join(' ') || member.username || 'bạn')
          .replaceAll('{group}', message.chat.title ?? 'group');
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
    metrics.actions.delete += 1;
    await callTelegram('deleteMessage', { chat_id: message.chat.id, message_id: message.message_id }).catch((error) => {
      log('warn', 'telegram.deleteMessage.failed', { error: error?.message ?? String(error) });
      return null;
    });
    await logEvent(policy.group.id, 'bot', 'message_deleted', 'message', String(message.message_id), {
      reason: decision.reason,
      userId: String(message.from?.id ?? ''),
      signals: decision.signals,
    });
  }
  if (decision.action === 'warn') {
    metrics.actions.warn += 1;
    await send(message.chat.id, 'Cảnh báo: nội dung bị gắn cờ bởi rule group.');
  }
  if (decision.action === 'restrict') {
    metrics.actions.restrict += 1;
    await callTelegram('restrictChatMember', {
      chat_id: message.chat.id,
      user_id: Number(message.from?.id ?? 0),
      permissions: {
        can_send_messages: false,
        can_send_audios: false,
        can_send_documents: false,
        can_send_photos: false,
        can_send_videos: false,
        can_send_video_notes: false,
        can_send_voice_notes: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
      },
    }).catch((error) => {
      log('warn', 'telegram.restrictChatMember.failed', { error: error?.message ?? String(error) });
      return null;
    });
    await logEvent(policy.group.id, 'bot', 'restrict', 'member', String(message.from?.id ?? ''), { reason: decision.reason, signals: decision.signals });
  }
  if (decision.action === 'ban') {
    metrics.actions.ban += 1;
    await callTelegram('banChatMember', { chat_id: message.chat.id, user_id: Number(message.from?.id ?? 0) }).catch((error) => {
      log('warn', 'telegram.banChatMember.failed', { error: error?.message ?? String(error) });
      return null;
    });
    await logEvent(policy.group.id, 'bot', 'ban', 'member', String(message.from?.id ?? ''), { reason: decision.reason, signals: decision.signals });
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

async function pollTelegramUpdates() {
  metrics.polls += 1;
  metrics.lastPollAt = new Date().toISOString();
  const updates = await callTelegram('getUpdates', { offset, timeout: Math.floor(pollTimeoutMs / 1000), allowed_updates: ['message', 'my_chat_member'] });
  for (const update of updates) {
    offset = update.update_id + 1;
    metrics.updates += 1;
    metrics.lastUpdateAt = new Date().toISOString();
    await handleUpdate(update);
  }
}

async function heartbeat() {
  metrics.lastHeartbeatAt = new Date().toISOString();
  await fetch(`${apiBase}/api/internal/group-bot/ping`, { method: 'POST', headers: { 'x-internal-secret': internalSecret } }).catch((error) => {
    log('warn', 'heartbeat.failed', { error: error?.message ?? String(error) });
    return null;
  });
}

async function processQueueJob(job) {
  metrics.queueJobs += 1;
  metrics.lastQueueAt = new Date().toISOString();
  const payload = job.payload ?? {};
  try {
    if (job.job_type === 'send_broadcast') {
      const broadcastId = payload.broadcast_id;
      if (!broadcastId) throw new Error('Missing broadcast_id');
      const { data: broadcast, error } = await supabase
        .from('scam_broadcasts')
        .select('id, channel_id, message_text, status')
        .eq('id', broadcastId)
        .maybeSingle();
      if (error) throw error;
      if (!broadcast) throw new Error('Broadcast not found');
      if (!broadcast.message_text) throw new Error('Broadcast message is empty');
      await callTelegram('sendMessage', { chat_id: broadcast.channel_id, text: broadcast.message_text });
      await supabase.from('scam_broadcasts').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', broadcastId);
      metrics.queueSuccess += 1;
      return { success: true };
    }

    throw new Error(`Unsupported job type: ${job.job_type}`);
  } catch (error) {
    metrics.queueFailure += 1;
    await supabase.from('scam_broadcasts').update({ status: 'failed', last_error: error?.message ?? String(error) }).eq('id', payload.broadcast_id ?? null).catch(() => null);
    return { success: false, error };
  }
}

async function drainQueue() {
  if (!queueEveryPoll) return;
  while (true) {
    const { data, error } = await supabase.rpc('claim_job', { p_worker_id: workerId, p_job_type: null });
    if (error) {
      log('warn', 'queue.claim.failed', { error: error.message });
      return;
    }
    const job = data?.[0];
    if (!job) return;
    const result = await processQueueJob(job);
    const finished = await supabase.rpc('finish_job', {
      p_job_id: job.id,
      p_success: result.success,
      p_error: result.success ? null : (result.error?.message ?? 'Job failed'),
    });
    if (finished.error) {
      log('warn', 'queue.finish.failed', { jobId: job.id, error: finished.error.message });
    }
  }
}

function snapshot() {
  return {
    ...metrics,
    queueEnabled: queueEveryPoll,
    offset,
    backoffMs,
  };
}

async function loop() {
  while (true) {
    try {
      await pollTelegramUpdates();
      await drainQueue();
      await heartbeat();
      backoffMs = 0;
      log('info', 'loop.ok', snapshot());
      await delay(pollIdleDelayMs);
    } catch (error) {
      recordError(error, 'loop.failed');
      backoffMs = backoffMs > 0 ? Math.min(errorBackoffMaxMs, backoffMs * 2) : 1000;
      log('warn', 'loop.backoff', { backoffMs });
      await delay(backoffMs);
    }
  }
}

log('info', 'worker.started', snapshot());
await loop();
