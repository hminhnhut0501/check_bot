import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireReviewer } from '@/lib/auth/require-admin';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const supabase = createServerSupabaseClient();
  const { data: attachment } = await supabase.from('scam_report_attachments').select('storage_path, file_name, mime_type').eq('id', id).single();
  if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  const { data, error } = await supabase.storage.from('evidence').createSignedUrl(attachment.storage_path, 300);
  if (error) return NextResponse.json({ error: 'Could not create preview URL' }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl, file_name: attachment.file_name, mime_type: attachment.mime_type });
}
