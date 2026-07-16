# Phase 3 Admin Inbox

## Routes

- `/admin/login`: Supabase email/password login.
- `/admin/inbox`: review queue và report detail.
- `GET /api/admin/reports`: paginated queue, protected by reviewer role.
- `GET /api/admin/reports/:id`: report, attachments và review history.
- `POST /api/admin/reports/:id/action`: state transition endpoint.

## Review actions

```json
{
  "action": "confirm | reject | duplicate | need_more_info | assign",
  "note": "Reviewer note",
  "duplicate_of": "required for duplicate",
  "assigned_to": "optional user id for assign"
}
```

Confirm creates or reuses an entity identifier, updates the entity to `active`, marks the report `confirmed`, records a review action and writes an audit log.

## Local verification

```bash
npm install
npm run typecheck
npm run build
```

## Current UI limitations

- Duplicate action currently requires `duplicate_of` to be supplied by a follow-up UI flow.
- Attachment preview/download is not yet wired into the detail panel.
- Auth uses browser session storage from Supabase SSR client; production should add middleware for session refresh.
- Confirm does not yet enqueue broadcast; broadcast queue is Phase 6 scope.
