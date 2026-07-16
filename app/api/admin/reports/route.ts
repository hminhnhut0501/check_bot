import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';

export async function GET(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const page = Math.max(Number(url.searchParams.get('page') ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(url.searchParams.get('page_size') ?? 25), 1), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = createServerSupabaseClient()
    .from('scam_reports')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`tracking_code.ilike.%${search}%,target_name.ilike.%${search}%`);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data ?? [], page, page_size: pageSize, total: count ?? 0 });
}
