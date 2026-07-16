import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';

export async function GET(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const status = new URL(request.url).searchParams.get('status');
  let query = createServerSupabaseClient().from('disputes').select('*, scam_entities(display_name, entity_type, risk_level)').order('created_at', { ascending: false }).limit(100);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ disputes: data ?? [] });
}
