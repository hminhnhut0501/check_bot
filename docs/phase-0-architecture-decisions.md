# ScamShield Phase 0 Architecture Decisions

## ADR-001: Tách bot và admin thành hai runtime

**Quyết định:** Next.js chạy trên Vercel; Telegram bot/worker chạy trên Render.

**Lý do:** Vercel phù hợp request ngắn và UI; Render phù hợp process chạy dài, polling/webhook relay và background jobs.

## ADR-002: Supabase là system of record

**Quyết định:** Supabase PostgreSQL là nguồn dữ liệu chính; Supabase Storage lưu evidence; Supabase Auth quản lý admin.

**Lý do:** Giảm số dịch vụ, có RLS/Auth/Storage sẵn và phù hợp ngân sách MVP.

## ADR-003: Database-backed queue

**Quyết định:** Dùng bảng `job_queue` và Render worker thay vì Redis trong MVP.

**Lý do:** Không thêm hạ tầng trả phí; broadcast/retry và scoring có thể xử lý theo batch nhỏ.

## ADR-004: Report tách khỏi entity

**Quyết định:** Report là sự kiện/bằng chứng; entity là hồ sơ tổng hợp.

**Lý do:** Một entity có thể có nhiều report và nhiều identifier; dữ liệu không bị nhân bản và dễ audit.

## ADR-005: Rule engine trước AI

**Quyết định:** MVP dùng normalization, exact match, duplicate scoring và rule-based risk score.

**Lý do:** Dễ giải thích, dễ kiểm tra và không tạo chi phí inference. AI chỉ được xem xét sau khi có dữ liệu đủ sạch.

## ADR-006: Không hard-delete dữ liệu điều tra

**Quyết định:** Dùng disabled/archived/status; chỉ xóa attachment theo retention policy.

**Lý do:** Bảo toàn lịch sử, hỗ trợ dispute và audit.

## ADR-007: Public API qua server route

**Quyết định:** Browser gọi API của Next.js; API server truy vấn Supabase.

**Lý do:** Kiểm soát masking, rate limit, policy và tránh lộ service role key.

## ADR-008: Idempotency cho thao tác terminal

**Quyết định:** Confirm, reject, duplicate và broadcast phải hỗ trợ idempotency.

**Lý do:** Telegram retry, browser double-click hoặc worker retry không được tạo dữ liệu/broadcast trùng.

## ADR-009: Một workspace trong MVP

**Quyết định:** Chưa triển khai multi-tenant; vẫn để các bảng có thể mở rộng bằng `workspace_id` sau này.

**Lý do:** Giảm độ phức tạp, nhưng không khóa đường mở rộng.

## ADR-010: Observability tối thiểu

**Quyết định:** Có `/api/health`, structured logs, job failure records và audit logs ngay từ Phase 1.

**Lý do:** Worker và broadcast là các thành phần bất đồng bộ; thiếu log sẽ khó xử lý sự cố.

## Handoff sang Phase 1

Phase 1 cần triển khai theo thứ tự:

1. Tạo Supabase project và environment contract.
2. Viết migrations cho users/roles, entities, identifiers, aliases, reports, attachments, cases, actions, broadcasts, jobs và audit logs.
3. Thêm RLS policies và server-only service layer.
4. Tạo seed data và test trạng thái.
5. Dựng auth skeleton và health endpoint.

## Phase 0 checklist

- [x] Chốt mục tiêu và đối tượng sử dụng.
- [x] Chốt MVP in-scope/out-of-scope.
- [x] Chốt entity types.
- [x] Chốt report/entity/case status.
- [x] Chốt role và quyền chính.
- [x] Chốt public/private data policy.
- [x] Chốt Vercel/Render/Supabase architecture.
- [x] Chốt rule-based risk baseline.
- [x] Chốt các rủi ro và guardrails.
- [ ] Chốt thương hiệu/domain.
- [ ] Chốt kênh broadcast/review.
- [ ] Chốt retention và dispute policy theo pháp lý.
