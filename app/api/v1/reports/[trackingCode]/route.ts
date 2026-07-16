import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(_request: Request, context: { params: Promise<{ trackingCode: string }> }) {
  const { trackingCode } = await context.params;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('scam_reports')
    .select('tracking_code, status, priority, created_at, updated_at, reviewed_at')
    .eq('tracking_code', trackingCode)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Could not read report' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  return NextResponse.json({ report: data });
}
