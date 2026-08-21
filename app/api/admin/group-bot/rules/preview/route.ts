import { NextResponse } from 'next/server';
import { requireReviewer } from '@/lib/auth/require-admin';
import { loadGroupPolicy, evaluateModerationDecision } from '@/lib/group-bot/policy';

export async function POST(request: Request) {
  const auth = await requireReviewer(request);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const chatId = String(body.telegram_chat_id ?? body.chat_id ?? '').trim();
  const text = String(body.text ?? '').trim();
  const userId = String(body.user_id ?? '').trim();
  const username = body.username ? String(body.username).trim() : null;

  if (!chatId || !text || !userId) {
    return NextResponse.json({ error: 'telegram_chat_id, text and user_id are required' }, { status: 422 });
  }

  const policy = await loadGroupPolicy(chatId);
  const decision = evaluateModerationDecision(policy, text, userId, username);

  return NextResponse.json({
    policy: policy
      ? {
          group_id: policy.group.id,
          telegram_chat_id: policy.group.telegram_chat_id,
          title: policy.group.title,
          status: policy.group.status,
        }
      : null,
    decision,
  });
}
