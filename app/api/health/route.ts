import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    const supabase = createServerSupabaseClient();
    const [rules, jobs, broadcasts] = await Promise.all([
      supabase.from('scam_rules').select('id').limit(1),
      supabase.from('job_queue').select('id, status').in('status', ['pending', 'processing', 'failed']).limit(1000),
      supabase.from('scam_broadcasts').select('id, status').in('status', ['pending', 'failed', 'retrying']).limit(1000),
    ]);
    const error = rules.error || jobs.error || broadcasts.error;

    if (error) {
      return NextResponse.json(
        { ok: false, service: 'scamshield-api', database: 'unhealthy', checkedAt },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, service: 'scamshield-api', database: 'healthy', queue: jobs.data?.reduce((result, job) => ({ ...result, [job.status]: (result[job.status] ?? 0) + 1 }), {} as Record<string, number>), broadcasts: broadcasts.data?.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] ?? 0) + 1 }), {} as Record<string, number>), checkedAt });
  } catch {
    return NextResponse.json(
      { ok: false, service: 'scamshield-api', database: 'unconfigured', checkedAt },
      { status: 503 },
    );
  }
}
