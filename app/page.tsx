export default function HomePage() {
  return (
    <main className="public-shell">
      <section className="hero">
        <p className="eyebrow">CU BOT</p>
        <h1>1 bot, nhiều group, cấu hình gọn và dễ vận hành.</h1>
        <p className="muted">
          Tập trung vào moderation, thành viên, blacklist và welcome. Các luồng ScamShield cũ đã được tách khỏi điều hướng chính.
        </p>
        <div className="actions">
          <a href="/admin/group-bot">Mở Group Bot Admin</a>
          <a href="/admin/login">Đăng nhập</a>
        </div>
      </section>
    </main>
  );
}
