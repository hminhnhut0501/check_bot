'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

type OverviewRow = {
  group: { id: string; telegram_chat_id: string; title: string; username?: string | null; status: string };
  metrics: {
    member_count: number;
    active_member_count: number;
    restricted_member_count: number;
    banned_member_count: number;
    rule_count: number;
    enabled_rule_count: number;
    action_count_24h: number;
    blacklist_count: number;
    welcome_count: number;
    last_action_at: string | null;
  };
};

type TrendRow = { day: string; actions: number; joins: number; bans: number; restricts: number; deletes: number; warnings: number };
type TopItem = { action?: string; rule_id?: string; group_id?: string; count: number };
type Health = { ok: boolean; service: string; database: string; checkedAt: string; groups?: number; blacklist?: Record<string, number>; rules?: Record<string, number>; audit_24h?: { count: number; actions: Record<string, number> } };

export default function GroupBotOverviewPage() {
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [topActions, setTopActions] = useState<TopItem[]>([]);
  const [topRuleHits, setTopRuleHits] = useState<TopItem[]>([]);
  const [topGroups, setTopGroups] = useState<TopItem[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [sinceHours, setSinceHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function authHeaders() {
    const { data } = await createBrowserSupabaseClient().auth.getSession();
    return { authorization: `Bearer ${data.session?.access_token ?? ''}` };
  }

  async function load() {
    setLoading(true);
    const [overviewResponse, healthResponse] = await Promise.all([
      fetch(`/api/admin/group-bot/overview?since_hours=${sinceHours}`, { headers: await authHeaders() }),
      fetch('/api/health'),
    ]);
    const overviewResult = await overviewResponse.json();
    const healthResult = await healthResponse.json();
    if (!overviewResponse.ok) {
      setMessage(overviewResult.error ?? 'Không tải được overview');
      setRows([]);
      setTrend([]);
      setTopActions([]);
      setTopRuleHits([]);
      setTopGroups([]);
    } else {
      setRows(overviewResult.overview ?? []);
      setTrend(overviewResult.trend ?? []);
      setTopActions(overviewResult.top_actions ?? []);
      setTopRuleHits(overviewResult.top_rule_hits ?? []);
      setTopGroups(overviewResult.top_groups ?? []);
      setMessage('');
    }
    setHealth(healthResult ?? null);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [sinceHours]);

  return <main className="admin-shell">
    <header className="topbar">
      <div>
        <p className="eyebrow">CU BOT / OVERVIEW</p>
        <h1>Group Overview</h1>
        <p className="muted">Tổng hợp theo group, trend 7 ngày, top actions, top rule hits và health trạng thái hệ thống.</p>
      </div>
      <a className="secondary" href="/admin/group-bot">Quay lại dashboard</a>
    </header>

    <nav className="nav-pills" aria-label="Group bot navigation">
      <a href="/admin/group-bot">Dashboard</a>
      <a className="active" href="/admin/group-bot/overview">Overview</a>
      <a href="/">Trang chủ</a>
    </nav>

    <section className="toolbar">
      <label style={{ margin: 0, minWidth: 220 }}>
        Khung thời gian
        <select value={sinceHours} onChange={(event) => setSinceHours(Number(event.target.value))}>
          <option value={6}>6 giờ</option>
          <option value={24}>24 giờ</option>
          <option value={72}>72 giờ</option>
          <option value={168}>7 ngày</option>
        </select>
      </label>
      <button onClick={() => void load()}>Refresh</button>
    </section>

    {message && <p className="error">{message}</p>}

    {health && (
      <div className="overview-grid">
        <article className="overview-card">
          <h3>Health</h3>
          <p className="muted">{health.service} · {health.database}</p>
          <p className="muted">Checked at {new Date(health.checkedAt).toLocaleString('vi-VN')}</p>
        </article>
        <article className="overview-card">
          <h3>Groups</h3>
          <strong>{health.groups ?? 0}</strong>
          <p className="muted">bot_groups records</p>
        </article>
        <article className="overview-card">
          <h3>Rules health</h3>
          <p className="muted">{JSON.stringify(health.rules ?? {})}</p>
        </article>
        <article className="overview-card">
          <h3>Blacklist health</h3>
          <p className="muted">{JSON.stringify(health.blacklist ?? {})}</p>
        </article>
        <article className="overview-card">
          <h3>Audit 24h</h3>
          <strong>{health.audit_24h?.count ?? 0}</strong>
          <p className="muted">{JSON.stringify(health.audit_24h?.actions ?? {})}</p>
        </article>
      </div>
    )}

    {trend.length > 0 && (
      <article className="overview-card">
        <h3>Trend 7 days</h3>
        <div className="overview-metrics">
          {trend.map((day) => (
            <div key={day.day}>
              <span>{day.day}</span>
              <strong>{day.actions}</strong>
              <small>{day.joins} joins · {day.bans} bans · {day.restricts} restricts · {day.deletes} deletes</small>
            </div>
          ))}
        </div>
      </article>
    )}

    <div className="overview-grid">
      <article className="overview-card">
        <h3>Top actions</h3>
        {topActions.length ? topActions.map((item) => <p className="history" key={item.action}><strong>{item.action}</strong> <small>{item.count}</small></p>) : <p className="muted">No data</p>}
      </article>
      <article className="overview-card">
        <h3>Top rule hits</h3>
        {topRuleHits.length ? topRuleHits.map((item) => <p className="history" key={item.rule_id}><strong>{item.rule_id}</strong> <small>{item.count}</small></p>) : <p className="muted">No data</p>}
      </article>
      <article className="overview-card">
        <h3>Top groups</h3>
        {topGroups.length ? topGroups.map((item) => <p className="history" key={item.group_id}><strong>{item.group_id}</strong> <small>{item.count}</small></p>) : <p className="muted">No data</p>}
      </article>
    </div>

    {loading ? <p className="muted">Đang tải...</p> : (
      <div className="overview-grid">
        {rows.map((row) => (
          <article key={row.group.id} className="overview-card">
            <div className="detail-head">
              <div>
                <p className="eyebrow">{row.group.telegram_chat_id}</p>
                <h2>{row.group.title}</h2>
                <p className="muted">{row.group.username ? `@${row.group.username}` : 'No username'} · {row.group.status}</p>
              </div>
              <span className={`pill ${row.group.status}`}>{row.group.status}</span>
            </div>
            <div className="overview-metrics">
              <div><span>Members</span><strong>{row.metrics.member_count}</strong><small>{row.metrics.active_member_count} active</small></div>
              <div><span>Rules</span><strong>{row.metrics.rule_count}</strong><small>{row.metrics.enabled_rule_count} enabled</small></div>
              <div><span>Actions</span><strong>{row.metrics.action_count_24h}</strong><small>last {sinceHours}h</small></div>
              <div><span>Blacklist</span><strong>{row.metrics.blacklist_count}</strong><small>active items</small></div>
              <div><span>Welcome</span><strong>{row.metrics.welcome_count}</strong><small>enabled variants</small></div>
              <div><span>Last action</span><strong>{row.metrics.last_action_at ? new Date(row.metrics.last_action_at).toLocaleString('vi-VN') : 'N/A'}</strong><small>{row.metrics.restricted_member_count} restricted · {row.metrics.banned_member_count} banned</small></div>
            </div>
            <div className="actions">
              <a className="secondary" href="/admin/group-bot">Open group</a>
            </div>
          </article>
        ))}
      </div>
    )}
  </main>;
}
