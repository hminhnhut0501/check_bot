# Phase 6 Broadcast System

## Flow

```text
Confirm report
    -> create scam_broadcasts(status=pending)
    -> create job_queue(send_broadcast)
    -> Render worker calls internal dispatch
    -> Telegram sendMessage
    -> sent/failed + audit data
```

Nếu chưa có `TELEGRAM_BROADCAST_CHAT_ID`, confirm vẫn hoàn tất nhưng không tạo broadcast tự động.

## Routes

- `/admin/broadcasts`: Broadcast Center.
- `GET /api/admin/broadcasts`: list/filter broadcast.
- `POST /api/admin/broadcasts`: tạo broadcast thủ công.
- `POST /api/admin/broadcasts/:id/retry`: retry broadcast failed/cancelled.
- `POST /api/internal/broadcasts/dispatch`: worker-only dispatch endpoint.

## Environment

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_BROADCAST_CHAT_ID
INTERNAL_API_SECRET
SCAMSHIELD_API_URL
```

## Safety

- Broadcast chỉ được tạo từ entity `active`.
- Message có disclaimer trung lập.
- Gửi thật chỉ xảy ra khi worker gọi dispatch endpoint.
- Internal dispatch yêu cầu `x-internal-secret`.
- Broadcast failure được lưu `last_error`, attempt count và có retry thủ công.

## Known limitations

- Chưa có channel settings UI; hiện dùng `TELEGRAM_BROADCAST_CHAT_ID`.
- Queue claim đang xử lý một job/lần; cần database locking nâng cao trước khi chạy nhiều worker.
- Chưa có approval step riêng giữa confirm và send.
