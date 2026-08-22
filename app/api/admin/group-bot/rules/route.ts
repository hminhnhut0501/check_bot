import { NextResponse } from 'next/server';
import { requireReviewer } from '@/lib/auth/require-admin';
import { createRule, deleteRule, getGroupChatId, listRules, logAudit, updateRule } from '@/lib/group-bot/admin-service';
import { invalidateGroupPolicy } from '@/lib/group-bot/policy';

export async function GET(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id');
  if (!groupId) return NextResponse.json({ error: 'group_id is required' }, { status: 422 });
  const { data, error } = await listRules(groupId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const body = await request.json();
  if (!body.group_id || !body.rule_type || !body.pattern || !body.action) {
    return NextResponse.json({ error: 'group_id, rule_type, pattern and action are required' }, { status: 422 });
  }
  const { data, error } = await createRule({
    group_id: String(body.group_id),
    rule_type: String(body.rule_type),
    pattern: String(body.pattern),
    action: String(body.action),
    severity: Number(body.severity ?? 1),
    enabled: body.enabled !== false,
    priority: Number(body.priority ?? 100),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    group_id: String(body.group_id),
    actor_type: 'admin',
    actor_id: auth.user?.id ?? null,
    action: 'rule.create',
    resource_type: 'moderation_rule',
    resource_id: data.id,
    new_data: data,
  });
  const chatIdResult = await getGroupChatId(String(body.group_id));
  if (chatIdResult.data?.telegram_chat_id) invalidateGroupPolicy(chatIdResult.data.telegram_chat_id);
  return NextResponse.json({ rule: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const body = await request.json();
  const id = String(body.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 422 });
  const update: Record<string, unknown> = {};
  if (body.rule_type !== undefined) update.rule_type = String(body.rule_type);
  if (body.pattern !== undefined) update.pattern = String(body.pattern);
  if (body.action !== undefined) update.action = String(body.action);
  if (body.severity !== undefined) update.severity = Number(body.severity);
  if (body.enabled !== undefined) update.enabled = Boolean(body.enabled);
  if (body.priority !== undefined) update.priority = Number(body.priority);
  const { data, error } = await updateRule(id, update);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    group_id: data.group_id,
    actor_type: 'admin',
    actor_id: auth.user?.id ?? null,
    action: 'rule.update',
    resource_type: 'moderation_rule',
    resource_id: id,
    new_data: data,
  });
  if (data.group_id) {
    const chatIdResult = await getGroupChatId(data.group_id);
    if (chatIdResult.data?.telegram_chat_id) invalidateGroupPolicy(chatIdResult.data.telegram_chat_id);
  }
  return NextResponse.json({ rule: data });
}

export async function DELETE(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const id = url.searchParams.get('id')?.trim() ?? '';
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 422 });
  const { existing, error } = await deleteRule(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  await logAudit({
    group_id: existing.group_id,
    actor_type: 'admin',
    actor_id: auth.user?.id ?? null,
    action: 'rule.delete',
    resource_type: 'moderation_rule',
    resource_id: id,
    old_data: existing,
  });
  if (existing.group_id) {
    const chatIdResult = await getGroupChatId(existing.group_id);
    if (chatIdResult.data?.telegram_chat_id) invalidateGroupPolicy(chatIdResult.data.telegram_chat_id);
  }
  return NextResponse.json({ ok: true });
}
