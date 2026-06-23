import { expressjwt, GetVerificationKey } from 'express-jwt';
import { expressJwtSecret } from 'jwks-rsa';
import { Request, Response, NextFunction } from 'express';

const issuerUri = process.env.JWT_ISSUER_URI || 
  `${process.env.KEYCLOAK_SERVER_URL || 'http://localhost:8180'}/realms/${process.env.KEYCLOAK_REALM || 'p4u-realm'}`;

function keycloakJwtIssuers(): string | [string, ...string[]] {
  const realm = process.env.KEYCLOAK_REALM || 'p4u-realm';
  const serverUrl = (process.env.KEYCLOAK_SERVER_URL || 'http://localhost:8180').replace(/\/$/, '');
  const explicit = process.env.JWT_ISSUER_URI?.replace(/\/$/, '');
  const issuers = new Set<string>();
  if (explicit) issuers.add(explicit);
  issuers.add(`${serverUrl}/realms/${realm}`);
  issuers.add(`http://localhost:8180/realms/${realm}`);
  issuers.add(`http://127.0.0.1:8180/realms/${realm}`);
  const issuerList = [...issuers];
  return issuerList.length === 1 ? issuerList[0] : (issuerList as [string, ...string[]]);
}

export const jwtAuth = expressjwt({
  secret: expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${issuerUri}/protocol/openid-connect/certs`,
  }) as GetVerificationKey,
  issuer: keycloakJwtIssuers(),
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
    'vendor.portal.me.read',
    'vendor.portal.me.write',
    'vendor.portal.order.read',
    'vendor.portal.order.write',
    'vendor.portal.org_order.read',
    'vendor.portal.org_order.write',
    'vendor.portal.review.read',
    'vendor.portal.referral.read',
  ],
  CUSTOMER: [
    'customer.read.self',
    'customer.write.self',
    'vendor.read.public',
    'catalog.read.public',
    'content.read.public',
    'content.newsletter.subscribe',
    'order.read.self',
    'order.write.self',
    'cart.read.self',
    'cart.write.self',
    'notification.read.self',
    'notification.device.register',
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

export const requireRole = (role: string) => {
  const required = role.toUpperCase();
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!getRoles(auth).includes(required)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
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

export const requireVendorSelfOrAdmin = (vendorParam = 'vendorId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth;
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });
    const roles = getRoles(auth);
    if (roles.includes('ADMIN')) return next();

    const tokenVendorId = String(auth.vendor_id || auth.sub || '');
    const requestedVendorId = String(req.params[vendorParam] || '');
    if (!tokenVendorId || !requestedVendorId || tokenVendorId !== requestedVendorId) {
      return res.status(403).json({ message: 'Forbidden: vendor self access required' });
    }
    next();
  };
};

export const requireLinkedCustomerAccessOrAdmin = (customerParam = 'customerId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as any).auth;
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });
    const roles = getRoles(auth);
    if (roles.includes('ADMIN')) return next();

    const requestedCustomerId = String(req.params[customerParam] || '');
    const linked = Array.isArray(auth.linked_customer_ids)
      ? auth.linked_customer_ids.map((v: any) => String(v))
      : [];

    if (!requestedCustomerId || !linked.includes(requestedCustomerId)) {
      return res.status(403).json({ message: 'Forbidden: linked customer access required' });
    }
    next();
  };
};

