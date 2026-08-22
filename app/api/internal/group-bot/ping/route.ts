import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const secret = request.headers.get('x-internal-secret');
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, service: 'group-bot', checked_at: new Date().toISOString() });
}

