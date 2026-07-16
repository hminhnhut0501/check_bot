'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

type Broadcast = { id: string; channel_id: string; status: string; message_text: string; attempt_count: number; last_error?: string; created_at: string; sent_at?: string; scam_entities?: { display_name: string; entity_type: string; risk_level: string; risk_score: number } };

export default function BroadcastCenter() {
  const [items, setItems] = useState<Broadcast[]>([]);
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const client = () => createBrowserSupabaseClient();
  async function headers() { const { data } = await client().auth.getSession(); return { authorization: `Bearer ${data.session?.access_token ?? ''}` }; }
  async function load() { const response = await fetch(`/api/admin/broadcasts?status=${status}`, { headers: await headers() }); const result = await response.json(); if (response.status === 401) window.location.href = '/admin/login'; setItems(result.broadcasts ?? []); }
  async function retry(id: string) { const response = await fetch(`/api/admin/broadcasts/${id}/retry`, { method: 'POST', headers: await headers() }); const result = await response.json(); setMessage(response.ok ? 'Đã đưa broadcast vào hàng đợi retry' : result.error); await load(); }
  useEffect(() => { void load(); }, [status]);
  return <main className="admin-shell"><header className="topbar"><div><p className="eyebrow">SCAMSHIELD / OUTREACH</p><h1>Broadcast Center</h1></div><a href="/admin/inbox">Review Inbox</a></header><section className="toolbar"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option><option value="pending">Pending</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="retrying">Retrying</option></select><button onClick={() => void load()}>Refresh</button></section>{message && <p className="success">{message}</p>}<section className="queue">{items.map((item) => <article key={item.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 20, marginBottom: 14 }}><div className="detail-head"><div><p className="eyebrow">{item.channel_id}</p><h2>{item.scam_entities?.display_name ?? 'Entity không xác định'}</h2><p className="muted">{item.scam_entities?.risk_level ?? 'unknown'} · {item.status} · {item.attempt_count} attempts</p></div><span className={`pill ${item.status}`}>{item.status}</span></div><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'Arial, sans-serif', background: '#f5f7f5', padding: 16, borderRadius: 8 }}>{item.message_text}</pre>{item.last_error && <p className="error">{item.last_error}</p>}<div className="actions">{['failed', 'cancelled'].includes(item.status) && <button onClick={() => void retry(item.id)}>Retry</button>}<small className="muted">Tạo lúc {new Date(item.created_at).toLocaleString('vi-VN')}</small></div></article>)}</section></main>;
}
