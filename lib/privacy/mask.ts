export function maskPublicValue(value: string, type: string) {
  const text = value.trim();
  if (type === 'phone' || type === 'bank_account') return text.length <= 4 ? '****' : `${text.slice(0, 2)}${'*'.repeat(Math.max(2, text.length - 4))}${text.slice(-2)}`;
  if (type === 'email') {
    const [local, domain] = text.split('@');
    return local && domain ? `${local.slice(0, 1)}***@${domain}` : '***';
  }
  return text;
}
