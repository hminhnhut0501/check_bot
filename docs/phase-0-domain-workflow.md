# ScamShield Domain And Workflow Spec

## 1. Entity types

| Type | Ví dụ | Public lookup |
|---|---|---|
| person | Tên cá nhân | Có, nếu đã xác minh |
| phone | Số điện thoại | Mask mặc định |
| bank_account | Số tài khoản | Mask một phần |
| telegram_user | Username/user id | Có thể hiển thị username |
| telegram_group | Group/channel | Có thể hiển thị tên/link |
| website | Website | Có |
| domain | Domain | Có |
| email | Email | Mask mặc định |
| crypto_wallet | Địa chỉ ví | Có |
| social_account | Facebook/TikTok/etc. | Theo policy |
| company | Tổ chức/doanh nghiệp | Có nếu đã xác minh |
| unknown | Chưa phân loại | Không public mặc định |

## 2. Report status

```text
submitted -> triaged -> assigned -> investigating
                         |             |
                         v             v
                  need_more_info   confirmed
                         |             |
                         v             v
                   investigating   closed

submitted/triaged/assigned/investigating -> duplicate
submitted/triaged/assigned/investigating -> rejected
confirmed -> disputed -> dispute_reviewing -> confirmed/revised/closed
```

### Ý nghĩa

- `submitted`: report mới nhận, chưa được kiểm tra.
- `triaged`: đã kiểm tra sơ bộ và xác định priority.
- `assigned`: đã giao reviewer.
- `investigating`: đang kiểm tra evidence/entity match.
- `need_more_info`: cần reporter bổ sung thông tin.
- `confirmed`: report đủ căn cứ để xác nhận.
- `rejected`: không đủ căn cứ hoặc thông tin không hợp lệ.
- `duplicate`: trùng report khác; phải có `duplicate_of`.
- `disputed`: có yêu cầu phản biện từ bên liên quan.
- `closed`: hoàn tất xử lý, không còn action đang mở.

## 3. Entity status

```text
under_review -> active
under_review -> disabled
active -> disputed
disputed -> active/disabled
active -> archived
```

- `under_review`: có dữ liệu nhưng chưa đủ căn cứ public như confirmed.
- `active`: entity đang có cảnh báo hiệu lực.
- `disabled`: tạm ẩn khỏi lookup public nhưng giữ lịch sử.
- `disputed`: đang xử lý phản biện.
- `archived`: không còn theo dõi chủ động.

## 4. Review actions

Reviewer phải cung cấp note khi thực hiện:

- Confirm.
- Reject.
- Duplicate.
- Merge entity.
- Thay đổi risk level.
- Disable/enable entity.
- Approve broadcast.

## 5. Case workflow

```text
open -> investigating -> pending_review -> confirmed -> monitoring -> closed
```

Case được tạo khi:

- Có ít nhất hai report cùng liên quan đến một entity.
- Một report liên quan đến nhiều entity.
- Có quan hệ giữa nhiều identifier hoặc nhiều nhóm.
- Reviewer cần theo dõi điều tra dài hơn một report đơn lẻ.

## 6. Risk score baseline

| Tín hiệu | Điểm |
|---|---:|
| Một report đã confirmed | +40 |
| Hai reporter độc lập trở lên | +25 |
| Identifier trùng entity active khác | +15 |
| Có evidence giao dịch | +10 |
| Được đề cập ở nhiều source khác nhau | +10 |
| Có attachment hợp lệ | +10 |
| Report bị reject | -20 |
| Evidence trùng report đã reject | -15 |
| Dispute hợp lệ | -20 |

| Khoảng điểm | Risk level |
|---:|---|
| 0-19 | unknown/low |
| 20-39 | medium |
| 40-69 | high |
| 70+ | critical |

Điểm chỉ là hỗ trợ quyết định, không tự thay thế review.

## 7. Report intake bắt buộc

Các trường tối thiểu:

- Target type.
- Target identifier hoặc target name.
- Incident type.
- Mô tả sự việc.
- Thời gian gần đúng.
- Nguồn xảy ra sự việc.
- Ít nhất một trong: evidence text, attachment, transaction reference.

Có thể cho phép gửi thiếu trường, nhưng phải chuyển sang `need_more_info`, không được tự động confirm.

## 8. Confirm flow

1. Kiểm tra quyền và idempotency key.
2. Lock report.
3. Kiểm tra report chưa ở trạng thái terminal.
4. Tìm entity match exact/alias.
5. Reviewer chọn link entity cũ hoặc tạo entity mới.
6. Lưu identifiers, aliases và evidence references.
7. Tính risk score.
8. Cập nhật report/entity/case trong một transaction.
9. Ghi review action và audit log.
10. Tạo broadcast job nếu policy cho phép.
11. Thông báo reporter.

## 9. Nguyên tắc duplicate/merge

- Duplicate report không làm mất report gốc.
- `duplicate_of` bắt buộc trỏ tới report canonical.
- Entity merge phải giữ alias của entity cũ.
- Merge phải tạo audit record chứa source và target entity.
- MVP chỉ đề xuất merge; Senior Reviewer thực hiện merge.
