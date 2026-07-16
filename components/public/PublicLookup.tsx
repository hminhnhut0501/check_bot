'use client';

import { FormEvent, useState } from 'react';

type Match = { id: string; display_name: string; entity_type: string; risk_level: string; risk_score: number; source_count: number; confirmed_report_count: number; result_type: string };

export default function PublicLookup() {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setMessage(''); const response = await fetch(`/api/v1/lookup?q=${encodeURIComponent(query)}`); const result = await response.json(); if (!response.ok) { setMessage(result.error ?? 'Không thể tra cứu'); return; } setMatches(result.matches ?? []); if (!result.matches?.length) setMessage('Chưa có dữ liệu xác minh. Điều này không đồng nghĩa đối tượng an toàn.'); }
  return <main className="public-shell"><nav><a href="/">ScamShield</a><span><a href="/report">Gửi báo cáo</a> · <a href="/dispute">Phản biện dữ liệu</a></span></nav><section className="hero"><p className="eyebrow">COMMUNITY RISK CHECK</p><h1>Kiểm tra trước khi giao dịch.</h1><p className="muted">Tra cứu số điện thoại, tài khoản ngân hàng, username, website hoặc ví crypto.</p><form className="lookup-form" onSubmit={submit}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập identifier cần kiểm tra" required minLength={2} /><button>Tra cứu</button></form></section><section className="results"><h2>Kết quả</h2>{message && <p className="muted">{message}</p>}{matches.map((match) => <article className="result-card" key={match.id}><div><p className="eyebrow">{match.entity_type} · {match.result_type}</p><h3>{match.display_name}</h3><p className="muted">{match.confirmed_report_count} báo cáo xác minh · {match.source_count} nguồn</p></div><strong className={`public-risk ${match.risk_level}`}>{match.risk_level}<small>{match.risk_score}/100</small></strong></article>)}</section><p className="public-disclaimer">Dữ liệu là cảnh báo cộng đồng dựa trên các nguồn đã được review. Không tìm thấy dữ liệu không đồng nghĩa an toàn.</p></main>;
}
