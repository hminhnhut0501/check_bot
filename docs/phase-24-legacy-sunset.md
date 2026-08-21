# Phase 24 Legacy Sunset

Phase 24 là bước đóng hẳn phần legacy, giữ lại những gì cần cho lịch sử, và làm rõ đâu là source of truth hiện tại.

## Mục tiêu

- Không còn đường vận hành chính nào dựa vào ScamShield cũ.
- Có inventory rõ ràng cho phần còn giữ.
- Người mới vào repo biết ngay core hiện tại là Group Bot.
- Không để admin CP bị kéo ngược về mô hình cũ.

## Phạm vi

- Giữ `group-bot` làm dashboard chính.
- Giữ `overview`, `audit`, `health`, `backup`, `restore`, `maintenance`.
- Retire các route legacy admin/public cũ.
- Tạo trang legacy sunset để làm điểm tham chiếu lịch sử.
- Chốt tài liệu source of truth cho lộ trình còn lại.

## Deliverables

- Trang [Legacy Sunset](/Users/hminhnhut/Documents/Check_bot/app/admin/legacy/page.tsx).
- Inventory legacy rõ ràng.
- Roadmap đã đánh dấu phần cũ là retired.

## Tiêu chí hoàn thành

- Không còn click nhầm sang luồng cũ trong vận hành hằng ngày.
- Core admin pages chỉ còn Group Bot.
- Tài liệu repo cho biết rõ những phần nào vẫn còn vì lịch sử, không phải vì core hiện tại.

## Ghi chú vận hành

- Nếu cần xem lại ngữ cảnh cũ, mở trang legacy sunset.
- Nếu cần thao tác thực tế, quay về Group Bot dashboard.
