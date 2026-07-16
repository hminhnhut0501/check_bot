import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';

export async function GET(request: Request) {
  const auth = await requireReviewer(request); if (auth.response) return auth.response;
  const supabase = createServerSupabaseClient();
  const [reports, entities, jobs, broadcasts, disputes] = await Promise.all([
    supabase.from('scam_reports').select('status, priority, created_at').limit(5000),
    supabase.from('scam_entities').select('status, risk_level').limit(5000),
    supabase.from('job_queue').select('status, job_type').limit(5000),
    supabase.from('scam_broadcasts').select('status').limit(5000),
    supabase.from('disputes').select('status').limit(5000),
  ]);
  return NextResponse.json({ reports: reports.data ?? [], entities: entities.data ?? [], jobs: jobs.data ?? [], broadcasts: broadcasts.data ?? [], disputes: disputes.data ?? [], generated_at: new Date().toISOString() });
}
