# Phase 12-14 Group Bot Roadmap

Tài liệu này nối tiếp [Phase 11 Group Bot Re-Architecture](/Users/hminhnhut/Documents/Check_bot/docs/phase-11-group-bot-rearchitecture.md) và định hình các giai đoạn còn lại để hệ thống vận hành ổn định, dễ quản trị, và đủ bền cho sử dụng thực tế.

## Mục tiêu tổng thể

- Hoàn thiện CRUD và trải nghiệm quản trị.
- Nâng độ tin cậy của bot runtime.
- Làm rõ quan sát vận hành, đo lường, và sự cố.
- Tối giản legacy còn sót lại.
- Chuẩn bị cho scale nhiều group mà không cần viết lại lần nữa.

## Phase 12: Operations Hardening

### Mục tiêu

Đưa hệ thống từ trạng thái "dùng được" sang "vận hành an toàn".

### Phạm vi

- Edit/delete cho moderation rules.
- Edit/delete cho blacklist items.
- Edit/tắt/mở welcome messages.
- Search/filter member list.
- Xem lịch sử action của member.
- Toggle chế độ pause group.
- Cảnh báo trước khi ban/restrict action.
- Cache policy group trong bot runtime.
- Retry/backoff khi Telegram API lỗi.
- Log lỗi rõ ràng cho từng group và từng action.

### Deliverables

- Dashboard CRUD hoàn chỉnh hơn.
- Bot có chế độ safe action.
- Lỗi và action đều có trace đủ để debug nhanh.
- Group có thể paused tạm thời mà không phải xoá cấu hình.

### Tiêu chí hoàn thành

- Admin có thể chỉnh mọi rule phổ biến mà không cần sửa DB thủ công.
- Bot không thực hiện action nguy hiểm một cách mù quáng.
- Khi Telegram lỗi, hệ thống biết retry và báo rõ lý do.
- Group paused thì bot ngưng enforce nhưng vẫn giữ dữ liệu.

---

## Phase 13: Observability and Scale Readiness

### Mục tiêu

Làm cho hệ thống nhìn thấy được, đo được, và sẵn sàng mở rộng.

### Phạm vi

- Biểu đồ xu hướng 7 ngày trên overview.
- Top actions theo loại.
- Top rule hit.
- Top group hoạt động nhiều nhất.
- Action breakdown: delete, warn, restrict, ban, welcome, join.
- Health check chi tiết hơn cho bot runtime và DB.
- Cache refresh theo TTL.
- Chuẩn hoá audit event taxonomy.
- Thêm summary metrics cho group và toàn hệ thống.

### Deliverables

- Overview giàu thông tin hơn.
- Dashboard có tín hiệu vận hành rõ.
- Có thể xác định group nào đang nhiều spam, nhiều ban, hay nhiều lỗi.
- Có số liệu để quyết định group nào cần chỉnh rule.

### Tiêu chí hoàn thành

- Mở dashboard là biết group nào đang nóng.
- Có thể truy ngược một action bất thường về nguồn.
- Có số liệu để so sánh tuần này với tuần trước.
- Có cơ sở để đánh giá bot có đang “quá tay” hay không.

---

## Phase 14: Legacy Sunset and Maintenance Mode

### Mục tiêu

Dọn sạch phần legacy còn sót và đóng khung hệ thống ở trạng thái bảo trì ổn định.

### Phạm vi

- Gỡ bỏ/migrate các migration cũ không còn cần.
- Tách riêng legacy schema nếu vẫn muốn lưu archive.
- Dọn component, route, helper không còn ai dùng.
- Chốt seed dữ liệu mẫu cho group-bot.
- Viết tài liệu vận hành cho admin và bot restart/recovery.
- Chuẩn hoá backup/restore.

### Deliverables

- Repo gọn hơn, ít code chết hơn.
- Lịch sử migration rõ ràng.
- Có runbook vận hành.
- Có quy trình khôi phục khi bot hoặc DB gặp sự cố.
- Có maintenance mode để dừng hệ thống an toàn khi cần.

### Tiêu chí hoàn thành

- Không còn route legacy nằm trong đường vận hành chính.
- Không còn dashboard cũ gây nhầm lẫn.
- Có thể khởi động lại hệ thống và khôi phục cấu hình nhanh.
- Dữ liệu vận hành được bảo vệ và sao lưu rõ.

### Cách triển khai an toàn

1. Bật `APP_MAINTENANCE_MODE=1` hoặc `GROUP_BOT_MAINTENANCE_MODE=1` trước khi chạm vào DB lớn.
2. Chạy backup bằng `npm run backup`.
3. Nếu cần rollback, dùng `BACKUP_FILE=... npm run restore`.
4. Tắt maintenance mode sau khi kiểm tra `/api/health` và đăng nhập admin thành công.

### Runbook ngắn

- Khi bot lỗi, kiểm tra `/api/health` trước để xác định DB hay runtime.
- Nếu DB có vấn đề, giữ maintenance mode bật và restore từ file backup gần nhất.
- Nếu chỉ bot worker lỗi, restart `npm run bot` sau khi xác minh secret và token.
- Sau khi phục hồi, kiểm tra group settings, moderation rules, blacklist, welcome, và audit log của nhóm chính.

---

## Thứ tự ưu tiên khuyến nghị

1. Phase 12 trước, vì đây là phần tạo độ an toàn khi vận hành thật.
2. Phase 13 tiếp theo, để biết hệ thống đang hoạt động như thế nào.
3. Phase 14 sau cùng, khi bạn đã chắc chắn group-bot là core chính thức.

## Những gì không nên làm tiếp quá sớm

- Không thêm AI hoặc rule quá phức tạp trước khi ổn định vận hành.
- Không mở rộng dashboard sang nhiều tính năng điều tra cũ.
- Không thêm quá nhiều loại entity hay workflow mới nếu chưa có nhu cầu.
- Không tối ưu scale trước khi trải nghiệm và log đủ rõ.

## Kết luận

Nếu đi theo chuỗi này, hệ thống sẽ tiến hoá theo đúng thứ tự:

1. Chạy được.
2. Chạy an toàn.
3. Nhìn thấy và đo được.
4. Dọn sạch và ổn định lâu dài.

Đây là đường đi phù hợp nhất để Cú bot trở thành một hệ thống quản trị group gọn, nhẹ và bền.
