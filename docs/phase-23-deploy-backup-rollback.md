# Phase 23 Deploy, Backup, Restore, Rollback

Mục tiêu của phase này là biến việc vận hành thành một quy trình rõ ràng, có thể lặp lại, và có đường lui khi release gặp sự cố.

## Mục tiêu

- Có một nhịp deploy an toàn.
- Có backup trước khi thay đổi lớn.
- Có restore rõ ràng khi cần rollback dữ liệu.
- Có một checklist kiểm tra trước và sau release.

## Quy trình chuẩn

### Trước release

1. Bật maintenance mode nếu thay đổi đụng vào DB hoặc schema.
2. Chạy backup:

```bash
SUPABASE_DB_URL=... npm run backup
```

3. Kiểm tra schema và health:

```bash
SUPABASE_DB_URL=... npm run ops:check
```

### Trong release

1. Deploy code.
2. Apply migration nếu có.
3. Restart bot worker nếu có thay đổi runtime.

### Sau release

1. Kiểm tra `/api/health`.
2. Mở admin group-bot.
3. Kiểm tra 1 group thật:
   - rules
   - blacklist
   - welcome
   - member actions
   - audit log

## Restore / rollback

Khi cần rollback dữ liệu:

```bash
SUPABASE_DB_URL=... BACKUP_FILE=... npm run restore
```

Khi chỉ cần rollback code:

1. Quay lại commit ổn định.
2. Redeploy.
3. Khởi động lại bot worker.

## Checklist ngắn

- Backup đã chạy thành công.
- Schema check pass.
- Typecheck pass.
- Test pass.
- Health endpoint pass.
- Bot worker đã restart nếu cần.
- Maintenance mode đã tắt sau khi xác nhận ổn định.

## Khuyến nghị

- Không release DB lớn khi chưa có backup mới nhất.
- Không tắt maintenance mode cho tới khi health và admin login đều ổn.
- Không sửa tay SQL trong production nếu chưa có restore file tương ứng.
