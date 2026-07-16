import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';
import { getEvidenceProvider } from '@/lib/ai/provider';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReviewer(request); if (auth.response) return auth.response;
  const provider = getEvidenceProvider();
  if (!provider) return NextResponse.json({ status: 'not_configured', message: 'No evidence AI/OCR provider is configured.' }, { status: 501 });
  const { id } = await context.params; const supabase = createServerSupabaseClient();
  const { data: attachment } = await supabase.from('scam_report_attachments').select('*').eq('id', id).single();
  if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  const file = await supabase.storage.from('evidence').download(attachment.storage_path); if (file.error || !file.data) return NextResponse.json({ error: 'Could not read attachment' }, { status: 500 });
  const result = await provider.extractText({ bytes: new Uint8Array(await file.data.arrayBuffer()), mimeType: attachment.mime_type });
  await supabase.from('scam_report_attachments').update({ ocr_text: result.text, metadata: { ...(attachment.metadata ?? {}), ocr_provider: result.provider, ocr_confidence: result.confidence } }).eq('id', id);
  await supabase.from('audit_logs').insert({ actor_id: auth.user?.id, action: 'attachment.ocr', resource_type: 'scam_report_attachment', resource_id: id, new_data: { provider: result.provider, confidence: result.confidence } });
  return NextResponse.json({ status: 'completed', result });
}
