import { Request } from 'express';

export function getAuthSub(req: Request): string {
  const auth = (req as any).auth;
  const sub = auth?.sub;
  if (!sub) {
    throw new Error('Missing subject in token');
  }
  return sub;
}

export function clientIp(req: Request): string | undefined {
  const x = req.headers['x-forwarded-for'];
  if (typeof x === 'string') {
    return x.split(',')[0].trim();
  }
  return req.socket.remoteAddress;
}

export function parseLimitOffset(
  req: Request,
  defaults: { limit: number; maxLimit: number }
): { limit: number; offset: number } {
  const limitRaw = parseInt((req.query.limit as string) || String(defaults.limit), 10);
  const offsetRaw = parseInt((req.query.offset as string) || '0', 10);
  const limit = Math.min(
    defaults.maxLimit,
    Math.max(1, Number.isFinite(limitRaw) ? limitRaw : defaults.limit)
  );
  const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);
  return { limit, offset };
}
