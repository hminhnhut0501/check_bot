# Phase 30 Bot Worker Hardening

Phase 30 tách worker runtime thành 4 lớp rõ ràng:

- Policy runtime
- Backoff and retry
- Queue processing
- Observability

## Những gì đã làm

- Tách polling Telegram update khỏi xử lý queue.
- Đưa retry/backoff vào một cơ chế có trạng thái.
- Thêm structured logs cho loop, heartbeat, queue, Telegram failures.
- Thêm metrics nội bộ trong worker để xem nhịp poll, update, queue và lỗi gần nhất.
- Xử lý `send_broadcast` qua `job_queue` để queue có ý nghĩa thực sự.

## Lưu ý vận hành

- Worker dùng `claim_job` và `finish_job` để claim/complete job.
- `GROUP_BOT_QUEUE_ENABLED=false` có thể tắt queue drain nếu cần debug.
- `GROUP_BOT_POLL_TIMEOUT_MS`, `GROUP_BOT_IDLE_DELAY_MS`, `GROUP_BOT_ERROR_BACKOFF_MAX_MS`, `GROUP_BOT_HEARTBEAT_EVERY_MS` cho phép tinh chỉnh runtime mà không sửa code.

## Kết quả mong muốn

- Worker ít bị kẹt vòng lặp cứng.
- Lỗi Telegram không làm chết toàn bộ loop ngay lập tức.
- Có thể truy vết được worker đang làm gì qua log và metrics.

