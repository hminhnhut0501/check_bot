import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    const supabase = createServerSupabaseClient();
    const sinceAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [groups, blacklist, rules, auditLogs] = await Promise.all([
      supabase.from('bot_groups').select('id').limit(1),
      supabase.from('bot_blacklist_items').select('id, status').in('status', ['active', 'disabled']).limit(1000),
      supabase.from('bot_moderation_rules').select('id, status').in('status', ['active', 'disabled']).limit(1000),
      supabase.from('bot_audit_logs').select('id, action, created_at').gte('created_at', sinceAt).limit(1000),
    ]);
    const error = groups.error || blacklist.error || rules.error || auditLogs.error;

    if (error) {
      return NextResponse.json(
        { ok: false, service: 'group-bot-api', database: 'unhealthy', checkedAt },
        { status: 503 },
      );
    }

    const actionSummary = (auditLogs.data ?? []).reduce((result, item) => {
      result[item.action] = (result[item.action] ?? 0) + 1;
      return result;
    }, {} as Record<string, number>);

    return NextResponse.json({
      ok: true,
      service: 'group-bot-api',
      database: 'healthy',
      groups: groups.data?.length ?? 0,
      blacklist: blacklist.data?.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] ?? 0) + 1 }), {} as Record<string, number>),
      rules: rules.data?.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] ?? 0) + 1 }), {} as Record<string, number>),
      audit_24h: {
        count: auditLogs.data?.length ?? 0,
        actions: actionSummary,
      },
      checkedAt,
    });
  } catch {
    return NextResponse.json(
      { ok: false, service: 'group-bot-api', database: 'unconfigured', checkedAt },
      { status: 503 },
    );
  }
}
