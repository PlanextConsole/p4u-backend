export class TokenIntrospectionResponse {
  active?: boolean;
  exp?: number;
  iat?: number;
  sub?: string;
  username?: string;
  email?: string;
  preferred_username?: string;
  realm_access?: {
    roles?: string[];
  };
  resource_access?: any;
  scope?: string;
  client_id?: string;
  token_type?: string;
  permissions?: string[];

  private static readonly ROLE_PERMISSION_MAP: Record<string, string[]> = {
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

  constructor(data?: any) {
    if (data) {
      this.active = data.active;
      this.exp = data.exp;
      this.iat = data.iat;
      this.sub = data.sub;
      this.username = data.username;
      this.email = data.email;
      this.preferred_username = data.preferred_username;
      this.realm_access = data.realm_access;
      this.resource_access = data.resource_access;
      this.scope = data.scope;
      this.client_id = data.client_id;
      this.token_type = data.token_type;
      if (Array.isArray(data.permissions)) {
        this.permissions = data.permissions;
      } else if (typeof data.scope === 'string') {
        this.permissions = data.scope.split(' ').map((s: string) => s.trim()).filter(Boolean);
      } else {
        this.permissions = [];
      }

      if ((this.permissions ?? []).length === 0) {
        const roles = (this.realm_access?.roles || []).map((r) => String(r).toUpperCase());
        const derived = new Set<string>();
        for (const role of roles) {
          for (const permission of TokenIntrospectionResponse.ROLE_PERMISSION_MAP[role] || []) {
            derived.add(permission);
          }
        }
        this.permissions = [...derived];
      }
    }
  }
}

