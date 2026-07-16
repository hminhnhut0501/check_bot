# Phase 4 Entity Management

## Routes

- `/admin/entities`: danh sách entity và entity profile.
- `GET /api/admin/entities`: tìm kiếm/phân trang entity.
- `POST /api/admin/entities`: tạo entity thủ công.
- `GET /api/admin/entities/:id`: entity, identifiers, aliases, relations và cases.
- `POST /api/admin/entities/:id/action`: enable, disable, add_identifier, add_alias và merge.

## Entity actions

```json
{ "action": "add_identifier", "type": "phone", "value": "0901234567" }
{ "action": "add_alias", "type": "name", "value": "Tên khác" }
{ "action": "enable" }
{ "action": "disable" }
{ "action": "merge", "target_id": "entity-uuid" }
```

Merge moves identifiers and aliases to the target, re-links case references, archives the source entity and records an audit log.

## Verification

```bash
npm run typecheck
npm run build
```

## Known limitations

- Relation records are displayed but chưa có form tạo relation trực tiếp trong UI.
- Merge hiện xử lý tuần tự; production nên chuyển sang database function/transaction atomic.
- Alias conflict khi merge sẽ giữ alias ở target và xóa bản trùng từ source.
- Entity profile chưa hiển thị đầy đủ linked reports; sẽ bổ sung cùng Case Management.
