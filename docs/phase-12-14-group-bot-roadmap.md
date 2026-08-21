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

---

## Phase 15: Schema Standardization and Drift Control

### Mục tiêu

Chốt một đường migration chuẩn, biết rõ schema nào là source of truth, và giảm tối đa rủi ro khi migrate giữa local, staging, và production.

### Phạm vi

- Chốt version cho core schema và seed.
- Thêm checkpoint metadata cho schema group-bot.
- Thêm view tổng hợp cho group config.
- Bổ sung index còn thiếu cho query nóng.
- Chuẩn hóa comment/schema docs trực tiếp trong DB.
- Tạo quy trình kiểm tra drift trước khi release.

### Deliverables

- 1 migration standardization rõ ràng.
- 1 bảng version checkpoint cho schema.
- 1 view config tổng hợp cho admin/API.
- 1 checklist kiểm tra schema trước deploy.

### Tiêu chí hoàn thành

- Không còn mơ hồ migration nào là core, migration nào là seed.
- Có thể kiểm tra DB đang thiếu gì trước khi release.
- Admin/API có một view chuẩn để lấy config nhóm.

### Khuyến nghị thực thi

1. Chạy `0005_group_bot_core`.
2. Chạy `0006_phase14_seed_group_bot`.
3. Chạy `0007_phase15_schema_standardization`.
4. Dùng `schema:check` hoặc SQL check trước khi deploy.

---

## Phase 23: Deploy, Backup, Restore, Rollback

### Mục tiêu

Khóa quy trình release thành một nhịp an toàn: có backup, có kiểm tra, có rollback, và có checklist sau deploy.

### Phạm vi

- Chuẩn hoá backup trước mọi thay đổi lớn.
- Chuẩn hoá restore bằng file backup.
- Có lệnh ops check trước release.
- Có checklist release và post-release.
- Dùng maintenance mode cho thay đổi DB/schema.

### Deliverables

- Script `backup`, `restore`, `schema:check`, `ops:check`.
- Tài liệu vận hành phase 23.
- Quy trình release có đường lui rõ.

### Tiêu chí hoàn thành

- Có thể release mà không phải nhớ tay quá nhiều bước.
- Có thể rollback dữ liệu từ backup gần nhất.
- Có thể xác nhận health và schema trước khi tắt maintenance mode.

### Tài liệu tham chiếu

- [Phase 23 Deploy, Backup, Restore, Rollback](/Users/hminhnhut/Documents/Check_bot/docs/phase-23-deploy-backup-rollback.md)

---

## Phase 24: Legacy Sunset and Architecture Lock

### Mục tiêu

Khóa hẳn phần legacy khỏi đường vận hành chính, giữ lại chỉ để tra cứu lịch sử và tránh lộn core hiện tại với mô hình cũ.

### Phạm vi

- Giữ Group Bot là dashboard chính duy nhất.
- Đưa các route cũ vào trạng thái retire hoặc redirect.
- Thêm trang legacy sunset làm điểm tham chiếu.
- Chốt inventory legacy để biết phần nào còn tồn tại vì lịch sử.

### Deliverables

- Trang [Legacy Sunset](/Users/hminhnhut/Documents/Check_bot/app/admin/legacy/page.tsx).
- Tài liệu [Phase 24 Legacy Sunset](/Users/hminhnhut/Documents/Check_bot/docs/phase-24-legacy-sunset.md).
- Roadmap rõ ràng rằng phần cũ không còn là core vận hành.

### Tiêu chí hoàn thành

- Không còn nhầm lẫn giữa đường cũ và đường mới.
- Người dùng thực tế chỉ thấy Group Bot trong hành trình vận hành chính.
- Legacy chỉ còn là lịch sử, không còn là production path.

---

## Phase 25: Final Polish and Scale Readiness

### Mục tiêu

Khóa hẳn giao diện và tín hiệu vận hành ở mức đủ tự tin để mở rộng thêm group mà không phải chỉnh lại kiến trúc.

### Phạm vi

- Thêm scale readiness trên overview.
- Làm rõ trạng thái healthy / needs attention.
- Giữ UI gọn, ít nhiễu, dễ đọc nhanh.
- Không thêm module mới.

### Deliverables

- Khối scale readiness trên overview.
- Tài liệu [Phase 25 Final Polish And Scale Readiness](/Users/hminhnhut/Documents/Check_bot/docs/phase-25-final-polish-scale-readiness.md).

### Tiêu chí hoàn thành

- Dashboard cho biết ngay hệ thống đang sẵn sàng tới đâu.
- Có thể nhìn số group, member, rule, và action load trong một nhịp mắt.
- UI kết thúc ở trạng thái gọn, rõ, đủ bền.
