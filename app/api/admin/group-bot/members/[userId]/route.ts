import { NextResponse } from 'next/server';
import { requireReviewer } from '@/lib/auth/require-admin';
import { getMemberBundle } from '@/lib/group-bot/admin-service';

export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const { userId } = await context.params;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id');
  if (!groupId) return NextResponse.json({ error: 'group_id is required' }, { status: 422 });

  const { member, events, audit } = await getMemberBundle(groupId, userId);
  if (member.error) return NextResponse.json({ error: member.error.message }, { status: 500 });

  return NextResponse.json({
    member: member.data ?? null,
    events: events.data ?? [],
    audit: audit.data ?? [],
  });
}
