import { NextResponse } from 'next/server';
import { requireReviewer } from '@/lib/auth/require-admin';
import { summarizeAudit } from '@/lib/group-bot/admin-service';

export async function GET(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id');
  const sinceHours = Math.max(1, Math.min(Number(url.searchParams.get('since_hours') ?? 24), 168));
  const sinceAt = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  if (!groupId) return NextResponse.json({ error: 'group_id is required' }, { status: 422 });
  const { data, error } = await summarizeAudit(groupId, sinceAt, {
    action: url.searchParams.get('action'),
    resourceType: url.searchParams.get('resource_type'),
    actorType: url.searchParams.get('actor_type'),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ since_hours: sinceHours, since_at: sinceAt, summary: data });
}
