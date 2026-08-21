import { getMaintenanceMessage } from '@/lib/maintenance';

export default function MaintenancePage() {
  return (
    <main className="public-shell">
      <section className="hero">
        <p className="eyebrow">MAINTENANCE MODE</p>
        <h1>Hệ thống đang tạm bảo trì.</h1>
        <p className="muted">{getMaintenanceMessage()}</p>
        <div className="actions">
          <a href="/api/health">Kiểm tra trạng thái</a>
          <a href="/admin/login">Đăng nhập admin</a>
        </div>
      </section>
    </main>
  );
}
