/** Title Case for customer-facing vendor name display / storage normalization. */
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
