import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']);
const maxBytes = 10 * 1024 * 1024;

export async function POST(request: Request, context: { params: Promise<{ trackingCode: string }> }) {
  const { trackingCode } = await context.params;
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 422 });
  if (file.size <= 0 || file.size > maxBytes) return NextResponse.json({ error: 'File must be between 1 byte and 10 MB' }, { status: 413 });
  if (!allowed.has(file.type)) return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
  const supabase = createServerSupabaseClient();
  const { data: report } = await supabase.from('scam_reports').select('id').eq('tracking_code', trackingCode).single();
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  const path = `${report.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const upload = await supabase.storage.from('evidence').upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ error: 'Could not store attachment' }, { status: 500 });
  const { data, error } = await supabase.from('scam_report_attachments').insert({ report_id: report.id, storage_path: path, file_name: file.name, mime_type: file.type, file_size: file.size }).select('id, file_name, mime_type, file_size, created_at').single();
  if (error) { await supabase.storage.from('evidence').remove([path]); return NextResponse.json({ error: 'Could not register attachment' }, { status: 500 }); }
  return NextResponse.json({ attachment: data }, { status: 201 });
}
