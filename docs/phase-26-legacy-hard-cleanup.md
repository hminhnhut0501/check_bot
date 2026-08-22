# Phase 26 Legacy Hard Cleanup

Phase 26 là bước dọn dứt điểm lớp ScamShield cũ khỏi đường vận hành chính để repo chỉ còn lại một câu chuyện rõ ràng: group-bot là core.

## Mục tiêu

- Xóa các route/page legacy không còn phục vụ vận hành.
- Giữ lại chỉ những điểm thật sự cần cho entry point, bảo trì hoặc lịch sử.
- Làm cho `app/` và `app/api/` dễ đọc hơn, không còn nhầm lẫn giữa core mới và di sản cũ.

## Đã xóa

- `app/admin/broadcasts/page.tsx`
- `app/admin/cases/page.tsx`
- `app/admin/disputes/page.tsx`
- `app/admin/entities/page.tsx`
- `app/admin/inbox/page.tsx`
- `app/dispute/page.tsx`
- `app/lookup/page.tsx`
- `app/report/page.tsx`

## Đã giữ có chủ đích

- `app/admin/login/page.tsx`: entry point đăng nhập admin.
- `app/admin/legacy/page.tsx`: trang tham chiếu lịch sử cho phần cũ đã retire.
- `app/admin/group-bot/*`: trục vận hành mới.
- `app/api/admin/group-bot/*`: API chính của hệ thống mới.
- `app/api/health/route.ts`: health check chung.
- `app/api/internal/group-bot/*`: internal ping và control.

## Hướng dẫn sau cleanup

- Không tạo lại route ScamShield cũ trừ khi có yêu cầu archive rõ ràng.
- Nếu cần tra cứu lịch sử, dùng trang legacy sunset thay vì nối lại luồng cũ.
- Mọi tính năng admin mới phải đi qua `group-bot` trước.

