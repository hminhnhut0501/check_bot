import { NextResponse } from 'next/server';
import { requireReviewer } from '@/lib/auth/require-admin';
import { fetchGroupAdminBundle, logAudit, removeGroup, updateGroup } from '@/lib/group-bot/admin-service';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const { group, settings, members, rules, audit, blacklist, welcome, memberEvents } = await fetchGroupAdminBundle(id);
  if (group.error) return NextResponse.json({ error: group.error.message }, { status: 500 });
  if (!group.data) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  return NextResponse.json({
    group: group.data,
    settings: settings.data ?? null,
    members: members.data ?? [],
    rules: rules.data ?? [],
    audit: audit.data ?? [],
    blacklist: blacklist.data ?? [],
    welcome: welcome.data ?? [],
    member_events: memberEvents.data ?? [],
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const body = await request.json();
  const { data, error } = await updateGroup(id, {
    title: body.title !== undefined ? String(body.title).trim() : undefined,
    username: body.username !== undefined ? (body.username ? String(body.username).trim() : null) : undefined,
    status: body.status !== undefined ? String(body.status) : undefined,
    settings: body.settings && typeof body.settings === 'object' ? (body.settings as Record<string, unknown>) : undefined,
    updatedBy: auth.user?.id ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ group: data });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const { error } = await removeGroup(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    group_id: id,
    actor_type: 'admin',
    actor_id: auth.user?.id ?? null,
    action: 'group.removed',
    resource_type: 'group',
    resource_id: id,
    new_data: { status: 'removed' },
  });
  return NextResponse.json({ ok: true });
}
