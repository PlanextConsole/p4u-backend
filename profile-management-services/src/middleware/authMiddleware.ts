import { expressjwt, GetVerificationKey } from 'express-jwt';
import { expressJwtSecret } from 'jwks-rsa';
import { Request, Response, NextFunction } from 'express';

const issuerUri =
  process.env.JWT_ISSUER_URI ||
  `${process.env.KEYCLOAK_SERVER_URL || 'http://localhost:8180'}/realms/${process.env.KEYCLOAK_REALM || 'p4u-realm'}`;

export const jwtAuth = expressjwt({
  secret: expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${issuerUri}/protocol/openid-connect/certs`,
  }) as GetVerificationKey,
  issuer: issuerUri,
  algorithms: ['RS256'],
  requestProperty: 'auth',
});

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  ADMIN: ['*'],
  CUSTOMER: ['profile.read.self', 'profile.write.self'],
  VENDOR: ['customer.read.linked'],
};

const getRoles = (auth: any): string[] => {
  const roles = auth?.realm_access?.roles || [];
  return roles.map((r: string) => String(r).toUpperCase());
};

const getPermissions = (auth: any): string[] => {
  const merged = new Set<string>();

  if (Array.isArray(auth?.permissions)) {
    for (const p of auth.permissions) merged.add(String(p));
  }

  for (const s of String(auth?.scope || '')
    .split(' ')
    .map((x) => x.trim())
    .filter(Boolean)) {
    merged.add(s);
  }

  for (const role of getRoles(auth)) {
    for (const p of ROLE_PERMISSION_MAP[role] || []) merged.add(p);
  }

  return [...merged];
};

export const requireAnyRole = (roles: string[]) => {
  const required = roles.map((r) => r.toUpperCase());
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth;
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });
    if (!required.some((role) => getRoles(auth).includes(role))) {
      return res.status(403).json({ message: 'Forbidden: Insufficient role access' });
    }
    next();
  };
};

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth;
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });
    const perms = getPermissions(auth);
    if (!perms.includes('*') && !perms.includes(permission)) {
      return res.status(403).json({ message: `Forbidden: Missing permission ${permission}` });
    }
    next();
  };
};

export const requireCustomerSelfOrAdmin = (customerParam = 'customerId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth;
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });
    const roles = getRoles(auth);
    if (roles.includes('ADMIN')) return next();
    const tokenCustomerId = String(auth.customer_id || auth.sub || '');
    const requestedCustomerId = String(req.params[customerParam] || '');
    if (!tokenCustomerId || !requestedCustomerId || tokenCustomerId !== requestedCustomerId) {
      return res.status(403).json({ message: 'Forbidden: customer self access required' });
    }
    next();
  };
};
