import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (request.headers.get('x-internal-secret') !== process.env.INTERNAL_API_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  if (!body.event_type || !body.payload) return NextResponse.json({ error: 'event_type and payload are required' }, { status: 422 });
  const supabase = createServerSupabaseClient();
  await supabase.from('audit_logs').insert({ action: `integration.${body.event_type}`, resource_type: 'integration_event', new_data: body.payload });
  return NextResponse.json({ accepted: true });
}
