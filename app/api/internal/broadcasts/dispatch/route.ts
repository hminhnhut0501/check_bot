import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  if (request.headers.get('x-internal-secret') !== process.env.INTERNAL_API_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createServerSupabaseClient();
  const workerId = request.headers.get('x-worker-id') ?? `vercel-${crypto.randomUUID()}`;
  const { data: claimed } = await supabase.rpc('claim_job', { p_worker_id: workerId, p_job_type: 'send_broadcast' });
  const job = claimed?.[0];
  if (!job) return NextResponse.json({ processed: false });
  const broadcastId = String(job.payload?.broadcast_id ?? '');
  const { data: broadcast } = await supabase.from('scam_broadcasts').select('*').eq('id', broadcastId).single();
  if (!broadcast) { await supabase.rpc('finish_job', { p_job_id: job.id, p_success: false, p_error: 'Broadcast not found' }); return NextResponse.json({ processed: true, ok: false }); }
  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: broadcast.channel_id, text: broadcast.message_text, disable_web_page_preview: true }) });
    const telegram = await telegramResponse.json();
    if (!telegramResponse.ok || !telegram.ok) throw new Error(telegram.description ?? 'Telegram send failed');
    await supabase.from('scam_broadcasts').update({ status: 'sent', message_id: String(telegram.result.message_id), sent_at: new Date().toISOString(), attempt_count: broadcast.attempt_count + 1 }).eq('id', broadcastId);
    await supabase.rpc('finish_job', { p_job_id: job.id, p_success: true, p_error: null });
    return NextResponse.json({ processed: true, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown broadcast error';
    await supabase.from('scam_broadcasts').update({ status: 'failed', last_error: message, attempt_count: broadcast.attempt_count + 1 }).eq('id', broadcastId);
    await supabase.rpc('finish_job', { p_job_id: job.id, p_success: false, p_error: message });
    return NextResponse.json({ processed: true, ok: false, error: message }, { status: 502 });
  }
}
