import { NextResponse } from 'next/server';
import { requireReviewer } from '@/lib/auth/require-admin';
import { createWelcomeMessage, deleteWelcomeMessage, getGroupChatId, listWelcomeMessages, logAudit, updateWelcomeMessage } from '@/lib/group-bot/admin-service';
import { invalidateGroupPolicy } from '@/lib/group-bot/policy';

export async function GET(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id');
  if (!groupId) return NextResponse.json({ error: 'group_id is required' }, { status: 422 });
  const { data, error } = await listWelcomeMessages(groupId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ welcomes: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const body = await request.json();
  if (!body.group_id || !body.message_text) return NextResponse.json({ error: 'group_id and message_text are required' }, { status: 422 });
  const { data, error } = await createWelcomeMessage({
    group_id: String(body.group_id),
    variant_name: body.variant_name ? String(body.variant_name) : 'default',
    message_text: String(body.message_text),
    enabled: body.enabled !== false,
    conditions_json: typeof body.conditions_json === 'object' && body.conditions_json ? body.conditions_json : {},
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const chatIdResult = await getGroupChatId(String(body.group_id));
  if (chatIdResult.data?.telegram_chat_id) invalidateGroupPolicy(chatIdResult.data.telegram_chat_id);
  return NextResponse.json({ welcome: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const body = await request.json();
  const id = String(body.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 422 });
  const update: Record<string, unknown> = {};
  if (body.variant_name !== undefined) update.variant_name = String(body.variant_name);
  if (body.message_text !== undefined) update.message_text = String(body.message_text);
  if (body.enabled !== undefined) update.enabled = Boolean(body.enabled);
  if (body.conditions_json !== undefined) update.conditions_json = body.conditions_json ?? {};
  const { data, error } = await updateWelcomeMessage(id, update);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    group_id: data.group_id,
    actor_type: 'admin',
    actor_id: auth.user?.id ?? null,
    action: 'welcome.update',
    resource_type: 'welcome_message',
    resource_id: id,
    new_data: data,
  });
  if (data.group_id) {
    const chatIdResult = await getGroupChatId(data.group_id);
    if (chatIdResult.data?.telegram_chat_id) invalidateGroupPolicy(chatIdResult.data.telegram_chat_id);
  }
  return NextResponse.json({ welcome: data });
}

export async function DELETE(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const id = url.searchParams.get('id')?.trim() ?? '';
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 422 });
  const { existing, error } = await deleteWelcomeMessage(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Welcome not found' }, { status: 404 });
  await logAudit({
    group_id: existing.group_id,
    actor_type: 'admin',
    actor_id: auth.user?.id ?? null,
    action: 'welcome.delete',
    resource_type: 'welcome_message',
    resource_id: id,
    old_data: existing,
  });
  if (existing.group_id) {
    const chatIdResult = await getGroupChatId(existing.group_id);
    if (chatIdResult.data?.telegram_chat_id) invalidateGroupPolicy(chatIdResult.data.telegram_chat_id);
  }
  return NextResponse.json({ ok: true });
}
