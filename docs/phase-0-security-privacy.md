# ScamShield Security And Privacy Baseline

## 1. Data classification

| Mức | Dữ liệu | Quyền mặc định |
|---|---|---|
| Public | Entity đã confirm, risk level, summary đã redact | Public lookup |
| Internal | Review note, case timeline, rule detail | Reviewer/Admin |
| Sensitive | Reporter identity, chat id, raw evidence | Assigned reviewer/Admin |
| Secret | Bot token, service role key, internal API secret | Server environment only |

## 2. Public display policy

Mặc định public chỉ được thấy:

- Entity type.
- Tên/identifier đã được redact theo loại.
- Risk level.
- Summary trung lập.
- Số lượng report đã xác minh.
- Thời điểm cập nhật gần nhất.

Không public mặc định:

- Danh tính reporter.
- Chat id, user id, IP.
- Ảnh chụp nguyên bản.
- Số tài khoản đầy đủ.
- Nội dung trao đổi riêng tư.
- Report chưa review.

## 3. Secrets

Các biến bắt buộc dự kiến:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL
TELEGRAM_BOT_TOKEN
TELEGRAM_REVIEW_CHAT_ID
TELEGRAM_BROADCAST_CHAT_ID
INTERNAL_API_SECRET
```

`SUPABASE_SERVICE_ROLE_KEY`, bot token và internal secret chỉ được dùng ở server/Render worker.

## 4. Access control

- Public lookup không dùng service role trực tiếp từ browser.
- Admin route phải kiểm tra Supabase Auth và role server-side.
- Reviewer chỉ xem raw evidence của report được assign hoặc theo policy workspace.
- Chỉ Senior Reviewer/Admin được confirm critical hoặc merge entity.
- Mọi thay đổi dữ liệu quan trọng phải ghi audit log.

## 5. Upload protection

- Giới hạn kích thước file 10 MB trong MVP.
- Chỉ cho phép MIME type trong allowlist.
- Tạo SHA-256 để phát hiện file trùng.
- Lưu file trong private bucket.
- Dùng signed URL có thời hạn khi preview.
- Không render HTML/SVG không an toàn trực tiếp.
- Không cho phép file upload thực thi như script.

## 6. Abuse protection

- Rate limit theo IP, Telegram user và identifier.
- CAPTCHA hoặc challenge cho public report khi cần.
- Giới hạn số report/ngày/user.
- Chặn spam trùng nội dung.
- Log các request thất bại bất thường.
- Không cho public endpoint query toàn bộ database.

## 7. Privacy và dispute

Sản phẩm phải có:

- Privacy policy.
- Terms of use.
- Disclaimer: dữ liệu là thông tin cảnh báo, không phải phán quyết pháp lý.
- Form dispute/correction.
- Quy trình tạm ẩn entity khi có tranh chấp hợp lệ.
- Lịch sử thay đổi để khôi phục quyết định.

## 8. Retention baseline

Đề xuất ban đầu:

- Audit log: giữ tối thiểu 12 tháng.
- Report đã xử lý: giữ để phục vụ lịch sử và chống spam.
- Raw evidence: xem xét retention riêng theo loại dữ liệu.
- Attachment không hợp lệ hoặc spam: xóa sau khi ghi nhận hash và lý do.

Retention thực tế cần được chốt lại theo luật áp dụng và chính sách vận hành.
