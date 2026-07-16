# ScamShield Product Brief

## 1. Mục đích

ScamShield là nền tảng tiếp nhận, kiểm tra, xác minh và phát cảnh báo về các dấu hiệu lừa đảo. Sản phẩm được phát triển độc lập dựa trên module anti-scam hiện có, nhưng mở rộng từ mô hình "một báo cáo - một thao tác duyệt" thành hệ thống quản lý case, entity, bằng chứng và lịch sử điều tra.

## 2. Vấn đề cần giải quyết

- Người dùng không biết một số điện thoại, tài khoản ngân hàng, username hoặc website đã từng bị báo cáo hay chưa.
- Báo cáo hiện thường nằm rời rạc trong chat, khó đối chiếu và khó phát hiện trùng lặp.
- Reviewer thiếu một nơi tập trung để xem bằng chứng, liên kết các báo cáo và ghi nhận quyết định.
- Cảnh báo sau khi xác nhận chưa có trạng thái gửi, retry và audit đầy đủ.
- Dữ liệu chưa xác minh dễ bị nhầm với kết luận chính thức.

## 3. Tầm nhìn

Trở thành lớp kiểm tra rủi ro cộng đồng cho các giao dịch trực tuyến, trong đó mọi kết luận đều có nguồn, bằng chứng, mức độ tin cậy và lịch sử thay đổi rõ ràng.

## 4. Nguyên tắc sản phẩm

1. Report không đồng nghĩa với kết luận.
2. Không tìm thấy dữ liệu không đồng nghĩa với an toàn.
3. Mọi kết luận quan trọng phải giải thích được.
4. Ưu tiên bảo vệ dữ liệu cá nhân của reporter và người bị báo cáo.
5. Không xóa cứng dữ liệu điều tra; dùng trạng thái, archive và audit log.
6. Reviewer là người quyết định cuối trong MVP; rule engine chỉ hỗ trợ.
7. Thiết kế trước cho chi phí thấp: Vercel + Render + Supabase Free.

## 5. Đối tượng sử dụng

| Nhóm | Nhu cầu chính |
|---|---|
| Người tra cứu | Kiểm tra nhanh một identifier trước giao dịch |
| Reporter | Gửi báo cáo và theo dõi trạng thái |
| Reviewer | Xử lý queue, xem evidence, đưa ra kết luận |
| Senior reviewer | Duyệt kết luận nghiêm trọng, merge entity, broadcast |
| Admin | Quản lý user, rule, channel, cấu hình và audit |

## 6. MVP in-scope

- Public lookup cho phone, bank account, username, URL/domain, email và crypto wallet.
- Report intake qua web và Telegram.
- Tracking code cho từng report.
- Attachment lưu trong Supabase Storage.
- Review inbox có filter, search, assignment và status workflow.
- Entity profile, identifiers, aliases và liên kết report.
- Case cơ bản để gom nhiều report/entity.
- Rule-based risk score có lý do giải thích.
- Confirm, reject, duplicate và need-more-info.
- Telegram broadcast có log và retry.
- Auth, RBAC, audit log, rate limit và privacy baseline.

## 7. Out-of-scope trong MVP

- Tự động kết luận bằng AI.
- Crawl hàng loạt website, group hoặc mạng xã hội.
- OCR/video processing nặng theo thời gian thực.
- Multi-tenant billing.
- Mobile app native.
- Tự động merge entity không qua reviewer.

## 8. Tiêu chí thành công MVP

- Một report có thể đi từ submitted đến confirmed/rejected mà không cần chỉnh database thủ công.
- Reviewer thấy được report, evidence, entity match, risk reasons và lịch sử thao tác trong một màn hình.
- Một entity có thể chứa nhiều identifier, alias, report và case.
- Public lookup phân biệt rõ confirmed, under review, potential match và no match.
- Mỗi confirm/reject/broadcast đều có actor, thời gian, ghi chú và audit record.
- Hệ thống chạy được trên Vercel, Render và Supabase Free với pagination, giới hạn upload và database queue.

## 9. Quyết định sản phẩm đã chốt

- Tên làm việc: `ScamShield`.
- Ngôn ngữ giao diện ban đầu: tiếng Việt; chuẩn bị i18n nhưng chưa cần dịch toàn bộ MVP.
- Mô hình dữ liệu: report và entity là hai khái niệm riêng.
- Entity là hồ sơ tổng hợp; report là nguồn sự kiện/bằng chứng.
- Dữ liệu public chỉ được hiển thị sau khi qua review theo policy.
- Confirm entity critical cần Senior Reviewer.
- Không hard-delete report, evidence, entity hoặc audit log.

## 10. Các điểm cần xác nhận trước Phase 1

- Tên thương hiệu chính thức và domain.
- Kênh Telegram review và kênh broadcast.
- Có cho phép public xem tên/identifier một phần hay chỉ xem masked value.
- Có cần hỗ trợ nhiều admin organization ngay từ đầu hay chỉ một workspace.
- Ngưỡng pháp lý và quy trình xử lý dispute cụ thể.
