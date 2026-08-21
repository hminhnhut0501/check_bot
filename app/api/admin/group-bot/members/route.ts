import { NextResponse } from 'next/server';
import { requireReviewer } from '@/lib/auth/require-admin';
import { listMembers } from '@/lib/group-bot/admin-service';

export async function GET(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id');
  if (!groupId) return NextResponse.json({ error: 'group_id is required' }, { status: 422 });
  const { data, error } = await listMembers(groupId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data ?? [] });
}
