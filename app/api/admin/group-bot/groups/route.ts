import { NextResponse } from 'next/server';
import { requireReviewer } from '@/lib/auth/require-admin';
import { createGroup, listGroups } from '@/lib/group-bot/admin-service';

export async function GET(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const { data, error } = await listGroups();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ groups: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;
  const body = await request.json();
  const telegramChatId = String(body.telegram_chat_id ?? '').trim();
  const title = String(body.title ?? '').trim();
  if (!telegramChatId || !title) return NextResponse.json({ error: 'telegram_chat_id and title are required' }, { status: 422 });
  const { data, error } = await createGroup({ telegram_chat_id: telegramChatId, title, username: body.username ? String(body.username).trim() : null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ group: data }, { status: 201 });
}
