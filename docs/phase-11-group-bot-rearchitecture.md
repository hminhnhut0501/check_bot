# Phase 11 Group Bot Re-Architecture

## 1. Mục tiêu

Tái cấu trúc hệ thống Cú bot theo hướng:

- Một bot duy nhất.
- Quản lý nhiều group.
- Chỉ giữ 4 năng lực lõi: kiểm duyệt, thành viên, blacklist, welcome.
- Giảm số bảng, số luồng xử lý và số màn hình quản trị.
- Tăng tốc độ vận hành, dễ cấu hình, dễ bảo trì, dễ mở rộng.

## 2. Phạm vi sản phẩm mới

### In-scope

- Quản lý nhiều group bằng một bot.
- Cấu hình riêng cho từng group.
- Kiểm duyệt message và member join.
- Blacklist theo user, username, keyword, link, domain, phone nếu cần.
- Welcome message theo group, theo thời điểm join.
- Nhật ký hành động tối giản.
- Dashboard admin gọn, tập trung vào cấu hình và theo dõi.

### Out-of-scope

- Report scam public.
- Entity graph, case management, dispute workflow.
- Broadcast công khai.
- Risk engine phức tạp.
- AI/OCR.
- Public lookup portal.

## 3. Sơ đồ module mới

```text
Telegram Updates
      |
      v
Bot Gateway / Update Handler
      |
      +--> Group Config Loader
      |        |
      |        +--> Cache group policy
      |
      +--> Moderation Engine
      |        |
      |        +--> anti-spam
      |        +--> keyword/link/domain filter
      |        +--> join approval / flood control
      |
      +--> Member Engine
      |        |
      |        +--> join/leave tracking
      |        +--> role/state sync
      |
      +--> Blacklist Engine
      |        |
      |        +--> user blacklist
      |        +--> username/phone/link/keyword blacklist
      |
      +--> Welcome Engine
      |        |
      |        +--> welcome template
      |        +--> conditional greeting
      |
      +--> Action Executor
               |
               +--> delete message
               +--> restrict member
               +--> ban/kick
               +--> reply/welcome
               +--> log event
```

### Nguyên tắc module

- Mỗi module chỉ làm một việc.
- Tất cả rule của một group phải đọc được trong một lần truy vấn hoặc từ cache.
- Bot runtime không nên phụ thuộc vào nhiều service.
- Mọi action quan trọng đều đi qua một lớp executor chung để dễ audit và retry.

## 4. Schema DB mới tối giản

Mục tiêu schema là lấy đúng dữ liệu cần cho group management, tránh mô hình scam-report nặng như hiện tại.

### Bảng lõi

#### `bots`

Thông tin bot global.

- `id`
- `telegram_bot_id`
- `name`
- `status`
- `created_at`
- `updated_at`

#### `groups`

Mỗi group Telegram được quản lý như một đơn vị độc lập.

- `id`
- `telegram_chat_id` unique
- `title`
- `username`
- `status` `active | paused | removed`
- `created_at`
- `updated_at`

#### `group_settings`

Cấu hình hành vi theo group.

- `group_id` unique
- `moderation_enabled`
- `welcome_enabled`
- `join_gate_enabled`
- `delete_link_enabled`
- `delete_keyword_enabled`
- `auto_restrict_enabled`
- `config_json`
- `updated_by`
- `updated_at`

#### `members`

Trạng thái member theo group.

- `id`
- `group_id`
- `telegram_user_id`
- `username`
- `display_name`
- `status` `member | restricted | left | banned`
- `joined_at`
- `left_at`
- `last_seen_at`
- `created_at`
- `updated_at`

#### `member_events`

Nhật ký sự kiện member tối giản.

- `id`
- `group_id`
- `telegram_user_id`
- `event_type` `join | leave | restrict | ban | unban | promote | demote`
- `payload_json`
- `created_at`

#### `blacklist_items`

Dùng chung cho mọi loại blacklist.

- `id`
- `group_id` nullable nếu là global blacklist
- `item_type` `user_id | username | keyword | phrase | domain | link | phone`
- `item_value`
- `normalized_value`
- `reason`
- `status` `active | disabled`
- `created_by`
- `created_at`
- `updated_at`

#### `welcome_messages`

Quản lý nội dung welcome.

- `id`
- `group_id`
- `variant_name`
- `message_text`
- `enabled`
- `conditions_json`
- `created_at`
- `updated_at`

#### `moderation_rules`

Rule kiểm duyệt theo group.

- `id`
- `group_id`
- `rule_type` `keyword | link | domain | flood | repeated_text | mention | join_gate`
- `pattern`
- `action` `delete | warn | restrict | ban | approve`
- `severity`
- `enabled`
- `priority`
- `created_at`
- `updated_at`

#### `audit_logs`

Nhật ký thay đổi admin và action bot quan trọng.

- `id`
- `group_id`
- `actor_type` `admin | bot | system`
- `actor_id`
- `action`
- `resource_type`
- `resource_id`
- `old_data`
- `new_data`
- `created_at`

### Bảng tùy chọn nếu cần sau

- `admin_users`
- `group_admins`
- `scheduled_jobs`
- `bot_sessions`

Những bảng này chỉ nên thêm nếu thật sự có use case rõ ràng.

### Index tối thiểu nên có

- `groups.telegram_chat_id`
- `members(group_id, telegram_user_id)`
- `blacklist_items(group_id, item_type, normalized_value)`
- `moderation_rules(group_id, enabled, priority)`
- `member_events(group_id, created_at desc)`
- `audit_logs(group_id, created_at desc)`

## 5. Luồng xử lý bot

### 5.1 Luồng update chung

```text
Telegram update
  -> xác định chat_id
  -> load group settings từ cache hoặc DB
  -> xác định loại event
  -> chạy rule engine theo thứ tự
  -> thực thi action
  -> ghi audit/minimal event
```

### 5.2 Luồng message thường

```text
message tới group
  -> kiểm tra group có active không
  -> kiểm tra blacklist
  -> kiểm tra moderation rules
  -> nếu vi phạm: delete/restrict/ban/warn
  -> nếu hợp lệ: cho qua
  -> ghi log nếu có action
```

### 5.3 Luồng member join

```text
member join
  -> lấy group settings
  -> kiểm tra join gate
  -> kiểm tra blacklist user/username
  -> kiểm tra điều kiện welcome
  -> lưu member state
  -> gửi welcome nếu được phép
  -> nếu cần: restrict tạm, chờ duyệt, hoặc ban
```

### 5.4 Luồng blacklist

```text
admin thêm blacklist item
  -> validate kiểu item
  -> normalize value
  -> lưu DB
  -> bot dùng ngay cho mọi update tiếp theo
```

### 5.5 Luồng welcome

```text
member join
  -> chọn template phù hợp
  -> render biến động như tên, group, rule
  -> gửi tin nhắn chào
```

## 6. Phần cần giữ / xóa / chuyển đổi

### Giữ

- Telegram worker bot.
- Supabase nếu muốn tiếp tục dùng DB + Auth + RLS.
- Rate limit và audit ở mức tối thiểu.
- Cơ chế cache cấu hình group.
- Một dashboard admin đơn giản.

### Xóa hoặc đóng băng

- Public report portal.
- Entity management.
- Case management.
- Dispute inbox.
- Broadcast center.
- Risk scoring phức tạp.
- Job queue chuyên cho report/broadcast.
- Lookup public.
- Attachment pipeline cũ.

### Chuyển đổi

- `scam_entities` -> bỏ, thay bằng `groups`, `members`, `blacklist_items`.
- `scam_reports` -> bỏ khỏi core.
- `review_actions` -> chuyển thành `member_events` và `audit_logs`.
- `scam_broadcasts` -> bỏ.
- `scam_rules` -> đổi thành `moderation_rules`.
- `job_queue` -> chỉ giữ nếu thật sự cần scheduled jobs; không dùng làm core flow.

## 7. Kiến trúc vận hành khuyến nghị

### Giai đoạn đầu

- Một bot process.
- Một database.
- Một dashboard admin.
- Cache in-memory hoặc Redis nếu cần scale sau.

### Khi bắt đầu nhiều group lớn hơn

- Tách bot runtime thành stateless worker.
- Cache policy theo group.
- Dùng job nhẹ cho tác vụ nền như sync, cleanup, summary.

### Điều cần tránh

- Không đưa moderation qua nhiều service.
- Không để mỗi action phải gọi quá nhiều bảng.
- Không nhét rule engine vào UI.
- Không để flow bot phụ thuộc vào public portal cũ.

## 8. Roadmap triển khai an toàn

### Giai đoạn 1: Cắt scope và dựng lõi mới

Mục tiêu:

- Chốt mô hình 1 bot nhiều group.
- Tạo schema tối giản.
- Dựng bot core cho message, join, blacklist, welcome.
- Dựng admin CRUD cơ bản cho group settings và blacklist.

Deliverables:

- Schema mới.
- Bot handler mới.
- Cấu hình theo group.
- Audit log tối thiểu.
- Test cho rule engine và normalization.

Rủi ro cần kiểm soát:

- Mất dữ liệu cũ khi migrate.
- Rule mới delete nhầm message.
- Welcome hoặc ban action lặp.

### Giai đoạn 2: Migration và chạy song song

Mục tiêu:

- Chạy bot mới song song với hệ thống cũ trong một số group test.
- Chuyển cấu hình và blacklist từ hệ thống cũ sang schema mới.
- So sánh kết quả moderation giữa hai hệ thống.

Deliverables:

- Script migrate dữ liệu cần thiết.
- Cơ chế rollback cấu hình group.
- Log so sánh hành vi bot cũ và mới.

Rủi ro cần kiểm soát:

- Cấu hình group không khớp.
- Bot mới thiếu một số rule edge-case.
- Admin thao tác nhầm giữa hai hệ thống.

### Giai đoạn 3: Cutover và dọn hệ thống cũ

Mục tiêu:

- Chuyển toàn bộ group sang bot mới.
- Tắt các route/module cũ không còn dùng.
- Giảm số bảng, giảm worker, giảm surface vận hành.

Deliverables:

- Danh sách module bị loại bỏ.
- Kiểm tra cuối cùng cho group settings.
- Monitoring đơn giản cho bot uptime và action count.

Rủi ro cần kiểm soát:

- Còn dependency ngầm ở dashboard cũ.
- Một số group chưa được migrate đủ setting.
- Thiếu quyền bot trên group thực tế.

## 9. Nguyên tắc ra quyết định

1. Nếu một chức năng không phục vụ trực tiếp moderation/member/blacklist/welcome thì không đưa vào core.
2. Nếu một thao tác cần hơn 1-2 truy vấn DB trong đường nóng, cần xem lại schema.
3. Nếu UI làm người dùng phải suy nghĩ quá nhiều, cần đơn giản hóa rule và trạng thái.
4. Nếu một bảng không có owner rõ ràng, chưa nên tạo.
5. Nếu một feature chỉ dùng cho một nhóm rất nhỏ, để vào phase sau.

## 10. Kết luận thực thi

Hướng đi tốt nhất là không “sửa nhỏ” hệ thống hiện tại, mà dựng một lõi mới theo nhóm:

- Bot trung tâm là first-class.
- Group là đơn vị dữ liệu chính.
- Rule phải ngắn, rõ, và chạy nhanh.
- Admin chỉ quản lý những gì ảnh hưởng trực tiếp đến hành vi bot.

Với cách này, hệ thống sẽ gọn hơn nhiều, dễ mở rộng hơn, và đặc biệt là giảm mạnh độ rối trong vận hành.

## 11. Roadmap tiếp theo

Sau phase này, lộ trình nên đi theo 3 bước:

1. Phase 12: Operations Hardening.
2. Phase 13: Observability and Scale Readiness.
3. Phase 14: Legacy Sunset and Maintenance Mode.

Chi tiết từng phase được mô tả trong [Phase 12-14 Group Bot Roadmap](/Users/hminhnhut/Documents/Check_bot/docs/phase-12-14-group-bot-roadmap.md).
