'use client';

import { FormEvent, useState } from 'react';

export default function DisputeForm() {
  const [form, setForm] = useState({ tracking_code: '', requester_name: '', requester_email: '', statement: '' });
  const [result, setResult] = useState('');
  function update(key: string, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent) { event.preventDefault(); const response = await fetch('/api/v1/disputes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) }); const data = await response.json(); setResult(response.ok ? `Đã tiếp nhận yêu cầu ${data.dispute.id}.` : data.error ?? 'Không thể gửi yêu cầu'); }
  return <main className="public-shell"><nav><a href="/">ScamShield</a><a href="/lookup">Tra cứu</a></nav><section className="form-card"><p className="eyebrow">DATA CORRECTION</p><h1>Phản biện dữ liệu</h1><p className="muted">Cung cấp thông tin cụ thể để reviewer có thể kiểm tra lại hồ sơ.</p><form onSubmit={submit}><label>Mã report nếu có<input value={form.tracking_code} onChange={(event) => update('tracking_code', event.target.value)} /></label><label>Tên người gửi<input value={form.requester_name} onChange={(event) => update('requester_name', event.target.value)} /></label><label>Email liên hệ<input type="email" value={form.requester_email} onChange={(event) => update('requester_email', event.target.value)} /></label><label>Nội dung phản biện<textarea value={form.statement} onChange={(event) => update('statement', event.target.value)} required minLength={20} /></label><button>Gửi yêu cầu</button></form>{result && <p className="success">{result}</p>}</section></main>;
}
