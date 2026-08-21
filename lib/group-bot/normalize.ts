export function normalizeValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}@._+\-/:#?=&]/gu, '');
}

export function detectMessageSignals(text: string) {
  const normalized = normalizeValue(text);
  const hasLink = /(https?:\/\/|t\.me\/|telegram\.me\/|www\.)/i.test(text);
  const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(text);
  const mentions = (text.match(/@\w+/g) ?? []).length;
  return { normalized, hasLink, hasPhone, mentions };
}

export function previewWelcomeMessage(template: string, name: string, group: string) {
  return template
    .replaceAll('{name}', name || 'bạn')
    .replaceAll('{group}', group || 'group');
}

export function previewNormalizedBlacklistValue(value: string) {
  return normalizeValue(value);
}
