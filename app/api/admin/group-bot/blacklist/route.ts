import { NextResponse } from 'next/server';
import { requireReviewer } from '@/lib/auth/require-admin';
import {
  createBlacklistItem,
  deleteBlacklistItem,
  listBlacklist,
  logAudit,
  normalizeGroupBotValue,
  updateBlacklistItem,
} from '@/lib/group-bot/admin-service';

export async function GET(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id');
  const { data, error } = await listBlacklist(groupId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const body = await request.json();
  const itemType = String(body.item_type ?? '').trim();
  const itemValue = String(body.item_value ?? '').trim();
  if (!itemType || !itemValue) return NextResponse.json({ error: 'item_type and item_value are required' }, { status: 422 });
  const { data, error } = await createBlacklistItem({
    group_id: body.group_id ? String(body.group_id) : null,
    item_type: itemType,
    item_value: itemValue,
    normalized_value: normalizeGroupBotValue(itemValue),
    reason: body.reason ? String(body.reason) : null,
    created_by: auth.user?.id ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const body = await request.json();
  const id = String(body.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 422 });
  const update: Record<string, unknown> = {};
  if (body.item_type !== undefined) update.item_type = String(body.item_type);
  if (body.item_value !== undefined) {
    update.item_value = String(body.item_value);
    update.normalized_value = normalizeGroupBotValue(String(body.item_value));
  }
  if (body.reason !== undefined) update.reason = body.reason === null ? null : String(body.reason);
  if (body.status !== undefined) update.status = String(body.status);
  const { data, error } = await updateBlacklistItem(id, update);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    group_id: data.group_id,
    actor_type: 'admin',
    actor_id: auth.user?.id ?? null,
    action: 'blacklist.update',
    resource_type: 'blacklist_item',
    resource_id: id,
    new_data: data,
  });
  return NextResponse.json({ item: data });
}

export async function DELETE(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const id = url.searchParams.get('id')?.trim() ?? '';
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 422 });
  const { existing, error } = await deleteBlacklistItem(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Blacklist item not found' }, { status: 404 });
  await logAudit({
    group_id: existing.group_id,
    actor_type: 'admin',
    actor_id: auth.user?.id ?? null,
    action: 'blacklist.delete',
    resource_type: 'blacklist_item',
    resource_id: id,
    old_data: existing,
  });
  return NextResponse.json({ ok: true });
}
