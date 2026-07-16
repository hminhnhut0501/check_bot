'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

type Dispute = { id: string; tracking_code?: string; requester_name?: string; requester_email?: string; statement: string; status: string; created_at: string; scam_entities?: { display_name: string; entity_type: string; risk_level: string } };

export default function DisputeInbox() {
  const [items, setItems] = useState<Dispute[]>([]);
  const [status, setStatus] = useState('submitted');
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<Dispute | null>(null);
  const client = () => createBrowserSupabaseClient();
  async function headers() { const { data } = await client().auth.getSession(); return { authorization: `Bearer ${data.session?.access_token ?? ''}` }; }
  async function load() { const response = await fetch(`/api/admin/disputes?status=${status}`, { headers: await headers() }); const result = await response.json(); if (response.status === 401) window.location.href = '/admin/login'; setItems(result.disputes ?? []); }
  async function act(nextStatus: string) { if (!selected) return; const response = await fetch(`/api/admin/disputes/${selected.id}/action`, { method: 'POST', headers: { ...(await headers()), 'content-type': 'application/json' }, body: JSON.stringify({ status: nextStatus, admin_note: note }) }); if (response.ok) { setSelected(null); setNote(''); await load(); } }
  useEffect(() => { void load(); }, [status]);
  return <main className="admin-shell"><header className="topbar"><div><p className="eyebrow">SCAMSHIELD / TRUST</p><h1>Dispute Inbox</h1></div><a href="/admin/inbox">Review Inbox</a></header><section className="toolbar"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="submitted">Submitted</option><option value="reviewing">Reviewing</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="closed">Closed</option></select><button onClick={() => void load()}>Refresh</button></section><div className="inbox-grid"><section className="queue">{items.map((item) => <button className={`report-row ${selected?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => setSelected(item)}><span><strong>{item.scam_entities?.display_name ?? item.tracking_code ?? item.id}</strong><small>{item.requester_email ?? 'No email'} · {item.status}</small></span></button>)}</section><section className="detail">{selected ? <><p className="eyebrow">{selected.id}</p><h2>{selected.scam_entities?.display_name ?? 'Dispute request'}</h2><p>{selected.statement}</p><p className="muted">{selected.requester_name} · {selected.requester_email}</p><textarea placeholder="Admin note" value={note} onChange={(event) => setNote(event.target.value)} /><div className="actions"><button onClick={() => void act('reviewing')}>Reviewing</button><button onClick={() => void act('accepted')}>Accept</button><button className="danger" onClick={() => void act('rejected')}>Reject</button><button className="secondary" onClick={() => void act('closed')}>Close</button></div></> : <div className="empty"><h2>Chọn dispute</h2></div>}</section></div></main>;
}
