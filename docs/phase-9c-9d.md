# Phase 9C-9D

## Phase 9C: Case Management

- `/admin/cases` case list/detail UI.
- `GET/POST /api/admin/cases`.
- `GET /api/admin/cases/:id`.
- `POST /api/admin/cases/:id/action`.
- Case lifecycle: open, investigating, pending_review, confirmed, monitoring, closed, archived.
- Link report and entity records.
- Review action history is recorded for case status/link actions.

## Phase 9D: UI foundation

Added shared primitives:

- `components/ui/Button.tsx`
- `components/ui/Badge.tsx`
- `components/ui/Card.tsx`

Added shared component styles in `app/components.css` and imported them from the root layout. Existing screens remain compatible while future redesign can replace repeated raw buttons/badges incrementally.

## Verification

```bash
npm run typecheck
npm run build
```

Both commands pass.

## Follow-up for full visual redesign

- Migrate admin pages to a shared AppShell/sidebar.
- Replace `window.prompt` with accessible dialogs.
- Add a table component with pagination and keyboard navigation.
- Add consistent loading, error and empty states.
- Add dark/light theme tokens only after the information architecture is stable.
