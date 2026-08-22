# Phase 31 UI/UX Polish

Phase 31 tập trung làm admin control panel nhẹ hơn, nhanh hơn và dễ ra quyết định hơn.

## Mục tiêu

- Rút gọn dashboard để người vận hành nhìn vào là biết cần làm gì.
- Làm các thao tác nhanh hơn, ít phải lướt và ít phải nhập lại.
- Có loading/toast/empty states rõ ràng để giảm cảm giác chậm và mơ hồ.
- Biến overview thành trang điều hành, không chỉ là trang thống kê.

## Vấn đề cần giải quyết

- Một màn dashboard đang chứa quá nhiều khu vực cùng lúc.
- Quick tools có ích nhưng chưa đủ “one-click” cho tình huống thường gặp.
- Phản hồi UI còn phụ thuộc vào message cuối trang, chưa đủ tức thì.
- Overview đang cho số liệu tốt nhưng chưa dẫn dắt hành động.

## Phạm vi

### In-scope

- Rút gọn layout dashboard chính.
- Tách nhóm thao tác theo mức độ thường dùng.
- Thêm quick actions cho tình huống vận hành thường xuyên.
- Thêm loading state, toast message, empty state, và error state.
- Nâng cấp overview thành trang điều hành với ưu tiên rõ ràng.

### Out-of-scope

- Thay đổi nghiệp vụ moderation.
- Thêm loại rule mới.
- Thay đổi schema DB core.
- Thêm workflow admin mới ngoài group-bot.

## 1. Rút gọn dashboard

### Hiện trạng

- Dashboard đang gom:
  - group list
  - create group
  - quick tools
  - settings
  - rules
  - members
  - audit
  - member detail
  - blacklist preview
  - welcome preview

### Hướng mới

- Chia dashboard thành 3 vùng chính:
  - `Sidebar` cho group list và quick create.
  - `Main control` cho tab nội dung đang chọn.
  - `Right rail` cho quick actions và trạng thái gần đây.
- Thu gọn phần `Quick tools` thành:
  - `Add blacklist`
  - `Add welcome`
  - `Preview moderation`
- Chỉ hiện `member detail` khi người dùng chọn member.
- Mỗi tab chỉ hiển thị đúng nội dung liên quan, tránh trộn quá nhiều form.

### Kết quả mong muốn

- Người dùng nhìn một lần là biết vùng nào để làm gì.
- Mỗi tác vụ quan trọng nằm gần nhau hơn.
- Ít cuộn hơn, ít phân tán hơn.

## 2. Quick actions thật nhanh

### Quick actions cần có

- `Pause group`
- `Resume group`
- `Add blacklist keyword`
- `Add welcome template`
- `Preview rule decision`
- `Restrict member`
- `Ban member`
- `Copy group ID`

### Yêu cầu UX

- Quick actions phải xuất hiện ở vị trí ổn định, không bị giấu sâu trong tab.
- Hành động nguy hiểm phải có confirm ngắn.
- Hành động thường dùng không nên yêu cầu mở modal dài.
- Với member, nên có hành động ngay trong row thay vì phải vào detail rồi mới bấm.

### Gợi ý triển khai

- Thêm `command bar` ở đầu dashboard.
- Thêm `row actions` cho member list và group list.
- Thêm `preset chips` cho blacklist/welcome:
  - keyword
  - domain
  - link
  - phone
  - spam phrase

## 3. Loading / toast / empty states

### Loading

- Tách loading theo khu vực:
  - loading groups
  - loading detail
  - loading member detail
  - loading overview
- Dùng skeleton hoặc placeholder text cho các card chính.
- Disable nút submit trong lúc request đang chạy.

### Toast

- Thay `message` cuối trang bằng toast nổi ngắn gọn.
- Toast cần có:
  - success
  - error
  - warning
  - info
- Toast tự ẩn sau một khoảng ngắn.

### Empty state

- Khi chưa có group:
  - giải thích bot cần group nào
  - đưa CTA tạo group ngay
- Khi chưa có rule:
  - gợi ý dùng preset rule đầu tiên
- Khi chưa có audit:
  - giải thích đây là group mới hoặc chưa phát sinh sự kiện
- Khi lọc member/audit không còn kết quả:
  - hiển thị empty state theo filter hiện tại

### Error state

- Mỗi khu vực có error riêng.
- Không để lỗi một phần làm sập toàn trang.
- Nên có nút `Retry` cho overview và group detail.

## 4. Overview thành trang điều hành

### Hiện trạng

- Overview đang thiên về dashboard số liệu.
- Có health, trend, top actions, top groups, and per-group summary.

### Hướng mới

- Overview phải trả lời 3 câu:
  - Group nào đang cần chú ý?
  - Hành vi nào bất thường?
  - Việc gì nên làm tiếp theo?

### Cần thêm

- `Attention queue`
  - groups có action load cao
  - groups có nhiều ban/restrict
  - groups có health xấu
- `Operational insight`
  - rule hits tăng bất thường
  - blacklist hit tăng nhanh
  - member churn cao
- `Recommended action`
  - ví dụ:
    - bật moderation
    - thêm blacklist
    - xem audit gần nhất
    - pause group

### Mẫu cấu trúc overview

- Header: trạng thái toàn hệ thống
- Section 1: cảnh báo cần chú ý
- Section 2: hành động nhanh
- Section 3: trend và top insight
- Section 4: bảng per-group

## 5. Tiêu chí hoàn thành

- Dashboard chính gọn hơn, ít block hơn và ít cuộn hơn.
- Có quick actions đủ nhanh cho nhu cầu thường gặp.
- Có loading/toast/empty/error states rõ ràng.
- Overview không chỉ hiển thị số liệu mà còn chỉ ra group cần xử lý.
- Trải nghiệm thao tác không còn cảm giác “bấm xong không biết gì đang xảy ra”.

## 6. Thứ tự triển khai

### Giai đoạn A

- Tách dashboard layout thành 3 vùng rõ ràng.
- Thêm quick action bar.
- Thêm toast system.

### Giai đoạn B

- Cải thiện loading/empty/error states.
- Thêm confirm cho hành động nguy hiểm.
- Thêm row actions cho member và group.

### Giai đoạn C

- Nâng overview thành operational view.
- Thêm attention queue và recommended actions.
- Tối ưu lại card hierarchy và số liệu ưu tiên.

