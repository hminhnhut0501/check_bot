import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';

function code() { return `CASE-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`; }

export async function GET(request: Request) {
  const auth = await requireReviewer(request); if (auth.response) return auth.response;
  const url = new URL(request.url); const status = url.searchParams.get('status');
  let query = createServerSupabaseClient().from('cases').select('*').order('updated_at', { ascending: false }).limit(100);
  if (status) query = query.eq('status', status);
  const { data, error } = await query; if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cases: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireReviewer(request); if (auth.response) return auth.response;
  const body = await request.json(); const title = String(body.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 422 });
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('cases').insert({ case_code: code(), title, summary: body.summary ?? null, severity: body.severity ?? 'medium', owner_id: auth.user?.id }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json({ case: data }, { status: 201 });
}
