export class AuthResponse {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  refreshExpiresIn?: number;
  roles?: string[];
  permissions?: string[];
  vendorId?: string | null;
  customerId?: string | null;
  message?: string;

  constructor(
    accessToken?: string,
    refreshToken?: string,
    tokenType?: string,
    expiresIn?: number,
    refreshExpiresIn?: number,
    roles?: string[],
    permissions?: string[],
    vendorId?: string | null,
    customerId?: string | null
  ) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenType = tokenType;
    this.expiresIn = expiresIn;
    this.refreshExpiresIn = refreshExpiresIn;
    this.roles = roles;
    this.permissions = permissions;
    this.vendorId = vendorId ?? null;
    this.customerId = customerId ?? null;
  }
}

