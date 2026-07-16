export function normalizeIdentifier(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .replace(/[^a-z0-9@._+\-]/g, '');
}

export function createTrackingCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `RPT-${stamp}-${suffix}`;
}
