# Phase 10 AI, OCR And Integrations

## Provider abstraction

`lib/ai/provider.ts` defines an opt-in `EvidenceAiProvider` with:

- OCR text extraction.
- Evidence summarization contract.

The default provider is `null`. This prevents raw evidence from being sent to an external AI service accidentally.

## OCR endpoint

```http
POST /api/admin/attachments/:id/analyze
Authorization: Bearer <reviewer-token>
```

It returns `501 not_configured` until a provider is explicitly installed and configured. When active, OCR text is stored in attachment metadata and audited.

## Integration contract

```http
POST /api/internal/integrations/event
X-Internal-Secret: <secret>
```

This provides a neutral event ingress for future Discord, CRM, webhook or moderation integrations.

## Safety rules

- AI output is advisory and never auto-confirms an entity.
- Provider name and confidence are stored with OCR output.
- Do not send reporter identity or unnecessary personal data to an external provider.
- Add human review before AI summaries appear in public broadcasts.
