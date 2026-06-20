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
  VENDOR: [
    'vendor.read.self',
    'vendor.write.self',
    'customer.read.linked',
    'catalog.read.public',
    'content.read.public',
    'content.newsletter.subscribe',
  ],
  CUSTOMER: [
    'customer.read.self',
    'customer.write.self',
    'vendor.read.public',
    'catalog.read.public',
    'content.read.public',
    'content.newsletter.subscribe',
  ],
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

  const scopePermissions = String(auth?.scope || '')
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of scopePermissions) merged.add(s);

  const roleDerived = new Set<string>();
  for (const role of getRoles(auth)) {
    for (const permission of ROLE_PERMISSION_MAP[role] || []) {
      roleDerived.add(permission);
    }
  }
  for (const p of roleDerived) merged.add(p);

  return [...merged];
};

export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const roles = auth.realm_access?.roles || [];
    const roleToCheck = role.toUpperCase();

    if (!roles.includes(roleToCheck)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};

export const requireAnyRole = (roles: string[]) => {
  const required = roles.map((r) => r.toUpperCase());
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const tokenRoles = getRoles(auth);
    const ok = required.some((role) => tokenRoles.includes(role));
    if (!ok) {
      return res.status(403).json({ message: 'Forbidden: Insufficient role access' });
    }
    next();
  };
};

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const perms = getPermissions(auth);
    if (!perms.includes('*') && !perms.includes(permission)) {
      return res.status(403).json({ message: `Forbidden: Missing permission ${permission}` });
    }
    next();
  };
};
