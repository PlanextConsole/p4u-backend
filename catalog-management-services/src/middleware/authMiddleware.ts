import { expressjwt, GetVerificationKey } from 'express-jwt';
import { expressJwtSecret } from 'jwks-rsa';
import { Request, Response, NextFunction } from 'express';

/** Accept tokens whether Keycloak iss is public URL, internal URL, or localhost (common VPS mismatch). */
function keycloakJwtConfig() {
  const realm = process.env.KEYCLOAK_REALM || 'p4u-realm';
  const serverUrl = (process.env.KEYCLOAK_SERVER_URL || 'http://localhost:8180').replace(/\/$/, '');
  const explicit = process.env.JWT_ISSUER_URI?.replace(/\/$/, '');
  const issuers = new Set<string>();
  if (explicit) issuers.add(explicit);
  issuers.add(`${serverUrl}/realms/${realm}`);
  issuers.add(`http://localhost:8180/realms/${realm}`);
  issuers.add(`http://127.0.0.1:8180/realms/${realm}`);
  const jwksBase = explicit || `${serverUrl}/realms/${realm}`;
  const issuerList = [...issuers];
  return {
    issuers: (issuerList.length === 1 ? issuerList[0] : issuerList) as string | [string, ...string[]],
    jwksUri: `${jwksBase}/protocol/openid-connect/certs`,
  };
}

const jwtCfg = keycloakJwtConfig();

export const jwtAuth = expressjwt({
  secret: expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: jwtCfg.jwksUri,
  }) as GetVerificationKey,
  issuer: jwtCfg.issuers,
  algorithms: ['RS256'],
  requestProperty: 'auth',
});

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  ADMIN: ['*'],
  VENDOR: ['catalog.read.public'],
  CUSTOMER: ['catalog.read.public'],
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
    const tokenRoles = getRoles(auth);
    if (!required.some((role) => tokenRoles.includes(role))) {
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
