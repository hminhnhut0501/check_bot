import { redirect } from 'next/navigation';

const retiredSections = [
  { label: 'Broadcasts', path: '/admin/broadcasts' },
  { label: 'Cases', path: '/admin/cases' },
  { label: 'Disputes', path: '/admin/disputes' },
  { label: 'Entities', path: '/admin/entities' },
  { label: 'Inbox', path: '/admin/inbox' },
];

export default function LegacySunsetPage() {
  if (retiredSections.length === 0) redirect('/admin/group-bot');

  return (
    <main className="admin-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">LEGACY SUNSET</p>
          <h1>Old ScamShield routes đã được retire khỏi đường vận hành chính.</h1>
          <p className="muted">
            Tất cả luồng admin chính đã chuyển sang Group Bot. Trang này chỉ còn để nhắc lại lịch sử và đưa đường đi đúng.
          </p>
        </div>
        <div className="actions">
          <a className="secondary" href="/admin/group-bot">Open Group Bot</a>
          <a className="secondary" href="/">Trang chủ</a>
        </div>
      </header>

      <div className="overview-grid">
        <article className="overview-card">
          <h3>Đã giữ</h3>
          <p className="muted">Group bot dashboard, overview, audit, health, backup/restore, maintenance mode.</p>
        </article>
        <article className="overview-card">
          <h3>Đã retire</h3>
          <p className="muted">Broadcasts, cases, disputes, entities, inbox và các route liên quan.</p>
        </article>
        <article className="overview-card">
          <h3>Điểm đến mới</h3>
          <p className="muted">Mọi thao tác vận hành hiện chạy qua /admin/group-bot.</p>
        </article>
      </div>

      <article className="overview-card">
        <h3>Retired sections</h3>
        <div className="overview-metrics">
          {retiredSections.map((section) => (
            <div key={section.path}>
              <span>{section.label}</span>
              <strong>{section.path}</strong>
              <small>redirected or retired</small>
            </div>
          ))}
        </div>
      </article>
    </main>
  );
}
