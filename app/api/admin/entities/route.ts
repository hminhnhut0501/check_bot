import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';

export async function GET(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const search = url.searchParams.get('search');
  const status = url.searchParams.get('status');
  const page = Math.max(Number(url.searchParams.get('page') ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(url.searchParams.get('page_size') ?? 25), 1), 100);
  let query = createServerSupabaseClient().from('scam_entities').select('*', { count: 'exact' }).order('updated_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`display_name.ilike.%${search}%,normalized_name.ilike.%${search}%`);
  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entities: data ?? [], total: count ?? 0, page, page_size: pageSize });
}

export async function POST(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const body = await request.json();
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('scam_entities').insert({ ...body, created_by: auth.user?.id, reviewed_by: auth.user?.id }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json({ entity: data }, { status: 201 });
}
