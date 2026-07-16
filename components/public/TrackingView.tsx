'use client';

import { useEffect, useState } from 'react';

export default function TrackingView({ code }: { code: string }) {
  const [report, setReport] = useState<{ tracking_code: string; status: string; priority: string; created_at: string; updated_at: string } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { fetch(`/api/v1/reports/${encodeURIComponent(code)}`).then(async (response) => { const data = await response.json(); if (!response.ok) setError(data.error); else setReport(data.report); }); }, [code]);
  return <main className="public-shell"><nav><a href="/">ScamShield</a><a href="/report">Gửi report mới</a></nav><section className="form-card"><p className="eyebrow">REPORT TRACKING</p><h1>{code}</h1>{error ? <p className="error">{error}</p> : report ? <><div className="tracking-status"><strong>{report.status}</strong><span>Priority: {report.priority}</span></div><p className="muted">Tạo lúc {new Date(report.created_at).toLocaleString('vi-VN')}</p><p className="muted">Cập nhật lúc {new Date(report.updated_at).toLocaleString('vi-VN')}</p><a href="/dispute">Muốn phản biện hoặc bổ sung thông tin?</a></> : <p className="muted">Đang tải...</p>}</section></main>;
}
