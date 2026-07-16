const token = process.env.TELEGRAM_BOT_TOKEN;
const apiBase = process.env.SCAMSHIELD_API_URL;
const internalSecret = process.env.INTERNAL_API_SECRET;

if (!token || !apiBase || !internalSecret) {
  throw new Error('TELEGRAM_BOT_TOKEN, SCAMSHIELD_API_URL and INTERNAL_API_SECRET are required');
}

const telegram = `https://api.telegram.org/bot${token}`;
const sessions = new Map();
let offset = 0;

async function callTelegram(method, body = {}) {
  const response = await fetch(`${telegram}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.description ?? `Telegram ${method} failed`);
  return result.result;
}

async function send(chatId, text) {
  await callTelegram('sendMessage', { chat_id: chatId, text });
}

async function createReport(chatId, state, messageId) {
  const response = await fetch(`${apiBase}/api/v1/reports`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-secret': internalSecret, 'x-idempotency-key': `telegram:${chatId}:${messageId}` },
    body: JSON.stringify({
      source_type: 'telegram',
      reporter_chat_id: String(chatId),
      source_chat_id: String(chatId),
      source_message_id: String(messageId),
      target_type: state.targetType,
      target_name: state.targetName,
      incident_type: state.incidentType,
      description: state.description,
      evidence_text: state.evidence,
      idempotency_key: `telegram:${chatId}:${messageId}`,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Report creation failed');
  return result.report;
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = (message.text ?? '').trim();
  if (text === '/start' || text === '/help') {
    await send(chatId, 'ScamShield\n/check <thông tin> để tra cứu\n/report để gửi báo cáo mới');
    return;
  }
  if (text.startsWith('/check ')) {
    const query = encodeURIComponent(text.slice(7).trim());
    const response = await fetch(`${apiBase}/api/v1/lookup?q=${query}`, { headers: { 'x-internal-secret': internalSecret } });
    const result = await response.json();
    await send(chatId, result.matches?.length ? JSON.stringify(result.matches.slice(0, 5), null, 2) : 'Chưa tìm thấy dữ liệu xác minh. Không tìm thấy không đồng nghĩa an toàn.');
    return;
  }
  if (text === '/report') {
    sessions.set(chatId, { step: 'targetType' });
    await send(chatId, 'Bước 1/5: loại đối tượng? Ví dụ: phone, bank_account, telegram_user, website');
    return;
  }

  const state = sessions.get(chatId);
  if (!state) return send(chatId, 'Gửi /report để tạo báo cáo hoặc /help để xem hướng dẫn.');
  if (state.step === 'targetType') {
    state.targetType = text;
    state.step = 'targetName';
    return send(chatId, 'Bước 2/5: nhập tên, số điện thoại, tài khoản hoặc URL cần báo cáo.');
  }
  if (state.step === 'targetName') {
    state.targetName = text;
    state.step = 'incidentType';
    return send(chatId, 'Bước 3/5: loại vụ việc? Ví dụ: investment_scam, ecommerce_scam, phishing.');
  }
  if (state.step === 'incidentType') {
    state.incidentType = text;
    state.step = 'description';
    return send(chatId, 'Bước 4/5: mô tả sự việc, thời gian và thiệt hại nếu có.');
  }
  if (state.step === 'description') {
    state.description = text;
    state.step = 'evidence';
    return send(chatId, 'Bước 5/5: nhập bằng chứng hoặc gõ “không có”.');
  }
  if (state.step === 'evidence') {
    state.evidence = text === 'không có' ? '' : text;
    try {
      const report = await createReport(chatId, state, message.message_id);
      await send(chatId, `Đã tiếp nhận báo cáo ${report.tracking_code}. Trạng thái: ${report.status}.`);
    } catch (error) {
      await send(chatId, `Không thể tạo báo cáo lúc này: ${error.message}`);
    } finally {
      sessions.delete(chatId);
    }
  }
}

async function poll() {
  const updates = await callTelegram('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
  for (const update of updates) {
    offset = update.update_id + 1;
    if (update.message) await handleMessage(update.message);
  }
}

async function processBroadcastJob() {
  const response = await fetch(`${apiBase}/api/internal/broadcasts/dispatch`, { method: 'POST', headers: { 'x-internal-secret': internalSecret } });
  if (!response.ok) console.error('Broadcast dispatch failed', await response.text());
}

while (true) {
  try { await poll(); await processBroadcastJob(); } catch (error) { console.error(error); await new Promise((resolve) => setTimeout(resolve, 3000)); }
}
