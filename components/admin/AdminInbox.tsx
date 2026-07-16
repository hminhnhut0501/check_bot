'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

type Report = { id: string; tracking_code: string; target_name: string; target_type: string; incident_type: string; description: string; status: string; priority: string; confidence_score: number; risk_score: number; created_at: string; admin_note?: string };
type Detail = { report: Report; attachments: Array<{ id: string; file_name: string; mime_type: string; file_size: number }>; actions: Array<{ id: string; action_type: string; note: string; created_at: string }>; risk?: { score: number; riskLevel: string; factors: Array<{ label: string; points: number; evidence?: string }> } };

export default function AdminInbox() {
  const [reports, setReports] = useState<Report[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  function getClient() {
    return createBrowserSupabaseClient();
  }

  async function token() {
    const { data } = await getClient().auth.getSession();
    return data.session?.access_token;
  }

  async function loadReports() {
    setLoading(true);
    const accessToken = await token();
    if (!accessToken) { window.location.href = '/admin/login'; return; }
    const params = new URLSearchParams({ page_size: '50' });
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    const response = await fetch(`/api/admin/reports?${params}`, { headers: { authorization: `Bearer ${accessToken}` } });
    if (response.status === 401 || response.status === 403) { window.location.href = '/admin/login'; return; }
    const result = await response.json();
    setReports(result.reports ?? []); setLoading(false);
  }

  async function selectReport(id: string) {
    const accessToken = await token();
    const response = await fetch(`/api/admin/reports/${id}`, { headers: { authorization: `Bearer ${accessToken}` } });
    setDetail(await response.json()); setNote(''); setMessage('');
  }

  async function act(action: string) {
    if (!detail) return;
    const accessToken = await token();
    const duplicateOf = action === 'duplicate' ? window.prompt('Nhập report ID canonical:') : undefined;
    if (action === 'duplicate' && !duplicateOf) return;
    const response = await fetch(`/api/admin/reports/${detail.report.id}/action`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ action, note, duplicate_of: duplicateOf }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error ?? 'Không thể cập nhật'); return; }
    setMessage(`Đã thực hiện: ${action}`); setDetail({ ...detail, report: result.report }); await loadReports();
  }

  async function recalculateRisk() {
    if (!detail) return;
    const accessToken = await token();
    const response = await fetch(`/api/admin/reports/${detail.report.id}/risk`, { method: 'POST', headers: { authorization: `Bearer ${accessToken}` } });
    const result = await response.json();
    if (response.ok) { setDetail({ ...detail, report: result.report, risk: result.risk }); setMessage('Đã tính lại risk score'); }
  }

  useEffect(() => { void loadReports(); }, [status]);

  return <main className="admin-shell">
    <header className="topbar"><div><p className="eyebrow">SCAMSHIELD / OPERATIONS</p><h1>Review Inbox</h1></div><button className="secondary" onClick={() => getClient().auth.signOut().then(() => { window.location.href = '/admin/login'; })}>Đăng xuất</button></header>
    <section className="toolbar"><input placeholder="Tìm tracking code hoặc đối tượng" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void loadReports()} /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option><option value="submitted">Submitted</option><option value="investigating">Investigating</option><option value="need_more_info">Need more info</option><option value="confirmed">Confirmed</option><option value="rejected">Rejected</option></select><button onClick={() => void loadReports()}>Lọc</button></section>
    <div className="inbox-grid"><section className="queue"><div className="section-title"><h2>Queue</h2><span>{reports.length} reports</span></div>{loading ? <p className="muted">Đang tải...</p> : reports.map((report) => <button className={`report-row ${detail?.report.id === report.id ? 'selected' : ''}`} key={report.id} onClick={() => void selectReport(report.id)}><span><strong>{report.tracking_code}</strong><small>{report.target_name} · {report.incident_type}</small></span><span className={`pill ${report.status}`}>{report.status}</span></button>)}</section>
      <section className="detail">{detail ? <><div className="detail-head"><div><p className="eyebrow">{detail.report.tracking_code}</p><h2>{detail.report.target_name}</h2><p className="muted">{detail.report.target_type} · {detail.report.incident_type}</p></div><div className="score">{detail.report.risk_score}<small>risk score</small></div></div><div className="facts"><div><span>Trạng thái</span><strong>{detail.report.status}</strong></div><div><span>Priority</span><strong>{detail.report.priority}</strong></div><div><span>Confidence</span><strong>{detail.report.confidence_score}</strong></div></div><article><h3>Mô tả</h3><p>{detail.report.description}</p></article><article><h3>Risk explanation</h3>{detail.risk?.factors.length ? detail.risk.factors.map((factor) => <p className="history" key={factor.label}><strong>{factor.points > 0 ? '+' : ''}{factor.points}</strong> · {factor.label} {factor.evidence && <small>{factor.evidence}</small>}</p>) : <p className="muted">Chưa có tín hiệu được tính.</p>}<button className="secondary" onClick={() => void recalculateRisk()}>Tính lại risk</button></article><article><h3>Evidence</h3><p>{detail.report.admin_note || 'Chưa có ghi chú nội bộ.'}</p><p className="muted">{detail.attachments.length} file đính kèm</p></article><textarea placeholder="Ghi chú bắt buộc cho action" value={note} onChange={(event) => setNote(event.target.value)} /><div className="actions"><button onClick={() => void act('confirm')}>Confirm</button><button className="danger" onClick={() => void act('reject')}>Reject</button><button className="secondary" onClick={() => void act('need_more_info')}>Need more info</button><button className="secondary" onClick={() => void act('duplicate')}>Duplicate</button></div>{message && <p className="success">{message}</p>}<h3>Review history</h3>{detail.actions.map((item) => <p className="history" key={item.id}><strong>{item.action_type}</strong> · {item.note} <small>{new Date(item.created_at).toLocaleString('vi-VN')}</small></p>)}</> : <div className="empty"><h2>Chọn một report</h2><p className="muted">Review evidence và quyết định ở panel này.</p></div>}</section></div>
  </main>;
}
