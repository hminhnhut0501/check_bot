import { NextResponse } from 'next/server';
import { requireReviewer } from '@/lib/auth/require-admin';
import { logAudit, recordMemberEvent, updateMemberStatus } from '@/lib/group-bot/admin-service';

export async function POST(request: Request, context: { params: Promise<{ userId: string }> }) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const { userId } = await context.params;
  const body = await request.json();
  const groupId = String(body.group_id ?? '');
  const action = String(body.action ?? '');
  if (!groupId || !action) return NextResponse.json({ error: 'group_id and action are required' }, { status: 422 });
  const status = action === 'ban' ? 'banned' : action === 'restrict' ? 'restricted' : action === 'unban' ? 'member' : null;
  if (!status) return NextResponse.json({ error: 'Unsupported action' }, { status: 422 });
  const { data, error } = await updateMemberStatus(groupId, userId, status);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recordMemberEvent(groupId, userId, action, { actor_id: auth.user?.id ?? null, status });
  await logAudit({
    group_id: groupId,
    actor_type: 'admin',
    actor_id: auth.user?.id ?? null,
    action: `member.${action}`,
    resource_type: 'member',
    resource_id: userId,
    new_data: { status },
  });
  return NextResponse.json({ member: data });
}
