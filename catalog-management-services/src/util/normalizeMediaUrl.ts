const GATEWAY_PATH_PREFIXES = ['/uploads', '/vendor-uploads', '/socio-uploads'] as const;

export function normalizeMediaUrl(url: string | null | undefined): string | null {
  if (url == null || typeof url !== 'string') return null;
  const u = url.trim();
  if (!u) return null;
  if (GATEWAY_PATH_PREFIXES.some((p) => u.startsWith(p))) return u;
  if (/^https?:\/\//i.test(u)) {
    try {
      const parsed = new URL(u);
      if (GATEWAY_PATH_PREFIXES.some((p) => parsed.pathname.startsWith(p))) {
        return `${parsed.pathname}${parsed.search}`;
      }
      return u;
    } catch {
      return u;
    }
  }
  return u.startsWith('/') ? u : u;
}

export function normalizeMediaUrlList(urls: string[] | null | undefined): string[] | null {
  if (urls == null) return null;
  if (!urls.length) return [];
  return urls.map((u) => normalizeMediaUrl(u) ?? u);
}

export function normalizeDocumentsJson(
  docs: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (docs == null) return null;
  if (typeof docs !== 'object' || Array.isArray(docs)) return docs;
  const out: Record<string, unknown> = { ...docs };
  for (const [key, val] of Object.entries(out)) {
    if (typeof val === 'string' && /Url$/i.test(key)) {
      out[key] = normalizeMediaUrl(val) ?? val;
    }
  }
  return out;
}
