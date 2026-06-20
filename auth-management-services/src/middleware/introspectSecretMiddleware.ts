import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

function timingSafeEqualString(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) {
      return false;
    }
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Requires header X-Introspect-Secret matching env INTROSPECT_API_KEY (min 16 chars recommended).
 * Use only for service-to-service or trusted backends — never expose the key to mobile clients.
 */
export const requireIntrospectSecret = (req: Request, res: Response, next: NextFunction) => {
  const expected = process.env.INTROSPECT_API_KEY;
  if (!expected || expected.length < 8) {
    return res.status(503).json({
      message: 'Token introspection is not configured. Set INTROSPECT_API_KEY in the environment.',
    });
  }

  const provided = (req.headers['x-introspect-secret'] as string) || '';
  if (!timingSafeEqualString(provided, expected)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  next();
};
