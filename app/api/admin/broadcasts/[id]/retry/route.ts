import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('scam_broadcasts').update({ status: 'retrying', last_error: null }).eq('id', id).in('status', ['failed', 'cancelled']).select('*').single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Broadcast is not retryable' }, { status: 409 });
  await supabase.from('job_queue').insert({ job_type: 'send_broadcast', payload: { broadcast_id: id }, status: 'pending' });
  await supabase.from('audit_logs').insert({ actor_id: auth.user?.id, action: 'broadcast.retry', resource_type: 'scam_broadcast', resource_id: id });
  return NextResponse.json({ broadcast: data });
}
