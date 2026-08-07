/** Title Case for vendor profile text fields. */
export function titleCaseWords(value: string | null | undefined): string {
  const text = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!text) return '';
  return text
    .split(' ')
    .map((word) =>
      word.replace(/([A-Za-z0-9]+)/g, (segment) => {
        if (!segment) return segment;
        if (/^\d+$/.test(segment)) return segment;
        return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
      }),
    )
    .join(' ');
}

const ADDRESS_TITLE_KEYS = [
  'areaLocality',
  'address',
  'city',
  'district',
  'state',
  'stateName',
  'shopAddress',
  'line1',
  'addressLine1',
] as const;

export function titleCaseAddressJson(
  addressJson: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined {
  if (addressJson == null) return addressJson;
  if (typeof addressJson !== 'object' || Array.isArray(addressJson)) return addressJson;
  const next: Record<string, unknown> = { ...addressJson };
  for (const key of ADDRESS_TITLE_KEYS) {
    const raw = next[key];
    if (typeof raw === 'string' && raw.trim()) {
      next[key] = titleCaseWords(raw);
    }
  }
  return next;
}
