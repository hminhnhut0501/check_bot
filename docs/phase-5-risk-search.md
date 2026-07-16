# Phase 5 Risk And Search

## Risk engine

The deterministic engine is in `lib/risk-engine/index.ts`. It returns:

- `score`: 0-100.
- `riskLevel`: unknown, low, medium, high or critical.
- `factors`: explainable positive/negative signals.

The engine is advisory only. It does not confirm, reject or merge reports automatically.

## Endpoints

- `GET /api/v1/lookup?q=...`: active entity search through normalized name, identifier and alias.
- `POST /api/admin/reports/:id/risk`: recalculate and persist report risk score.
- `GET /api/admin/reports/:id/duplicates`: return scored duplicate candidates.

## Duplicate scoring

Candidate signals:

- Exact target match: 70 points.
- Contained target match: 35 points.
- Same target type: 10 points.
- Three or more shared description words: 10 points.

Candidates under 35 points are hidden. The reviewer must still make the final duplicate decision.

## Known limitations

- Fuzzy search currently uses PostgreSQL `ilike`/trigram-ready indexes rather than a separate search service.
- Risk recalculation currently uses report-local evidence and same-target confirmed reports; entity-level aggregation will expand with Case Management.
- Duplicate candidate query is intentionally bounded to 50 records for Supabase Free.
