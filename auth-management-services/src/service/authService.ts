import KcAdminClient from '@keycloak/keycloak-admin-client';
import axios, { AxiosResponse } from 'axios';
import { AuthConstants } from '../constants/authConstants';
import { AuthResponse } from '../dto/AuthResponse';
import { LoginRequest } from '../dto/LoginRequest';
import { SignUpRequest } from '../dto/SignUpRequest';
import { TokenIntrospectionResponse } from '../dto/TokenIntrospectionResponse';
import { ForgotPasswordRequest } from '../dto/ForgotPasswordRequest';
import { ChangePasswordRequest } from '../dto/ChangePasswordRequest';
import { UserRepository } from '../repository/userRepository';
import { User } from '../entity/User';
import { CustomerProfileRepository } from '../repository/customerProfileRepository';
import { CustomerProfile } from '../entity/CustomerProfile';
import { VendorRegistrationRequestRepository } from '../repository/vendorRegistrationRequestRepository';
import { VendorRegistrationRequest } from '../entity/VendorRegistrationRequest';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in?: number;
}

interface AccessTokenClaims {
  realm_access?: { roles?: string[] };
  permissions?: string[];
  scope?: string;
  vendor_id?: string;
  customer_id?: string;
  sub?: string;
}

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

export class AuthService {
  private keycloakAdmin: KcAdminClient;
  private userRepository: UserRepository;
  private customerProfileRepository: CustomerProfileRepository;
  private vendorRegistrationRequestRepository: VendorRegistrationRequestRepository;
  private serverUrl: string;
  private realm: string;
  private clientId: string;
  private clientSecret: string;

  constructor(keycloakAdmin: KcAdminClient) {
    this.keycloakAdmin = keycloakAdmin;
    this.userRepository = new UserRepository();
    this.customerProfileRepository = new CustomerProfileRepository();
    this.vendorRegistrationRequestRepository = new VendorRegistrationRequestRepository();
    this.serverUrl = process.env.KEYCLOAK_SERVER_URL || 'http://localhost:8180';
    this.realm = process.env.KEYCLOAK_REALM || 'p4u-realm';
    this.clientId = process.env.KEYCLOAK_CLIENT_ID || 'auth-management-client';
    this.clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || '';
  }

  async signUp(request: SignUpRequest): Promise<AuthResponse> {
    const userType = request.userType.toUpperCase();
    if (!AuthConstants.isValidUserType(userType)) {
      throw new Error(`Invalid user type. Valid types: ${AuthConstants.VALID_USER_TYPES.join(', ')}`);
    }

    const existingUserByUsername = await this.userRepository.findByUsername(request.username);
    if (existingUserByUsername) {
      throw new Error('Username already exists');
    }

    const existingUserByEmail = await this.userRepository.findByEmail(request.email);
    if (existingUserByEmail) {
      throw new Error('Email already exists');
    }

    const keycloakUsers = await this.keycloakAdmin.users.find({
      username: request.username,
      exact: true,
    });
    if (keycloakUsers && keycloakUsers.length > 0) {
      throw new Error('Username already exists in Keycloak');
    }

    const keycloakUsersByEmail = await this.keycloakAdmin.users.find({
      email: request.email,
      exact: true,
    });
    if (keycloakUsersByEmail && keycloakUsersByEmail.length > 0) {
      throw new Error('Email already exists in Keycloak');
    }

    const keycloakUser = await this.keycloakAdmin.users.create({
      username: request.username,
      email: request.email,
      firstName: request.firstName,
      lastName: request.lastName,
      enabled: true,
      credentials: [
        {
          type: 'password',
          value: request.password,
          temporary: false,
        },
      ],
    });

    if (!keycloakUser.id) {
      throw new Error('Failed to create user');
    }

    const userId = keycloakUser.id;

    try {
      const role = await this.keycloakAdmin.roles.findOneByName({
        name: userType,
      });

      if (!role || !role.id) {
        throw new Error(`Role ${userType} not found in Keycloak`);
      }

      await this.keycloakAdmin.users.addRealmRoleMappings({
        id: userId,
        roles: [
          {
            id: role.id,
            name: role.name!,
          },
        ],
      });

      const user = new User();
      user.username = request.username;
      user.email = request.email;
      user.keycloakId = userId;
      user.userType = userType;
      await this.userRepository.save(user);
      await this.provisionCustomerProfileIfNeeded(userType, userId, request);
      await this.createPendingVendorRequestIfNeeded(userType, userId, request);
    } catch (err) {
      // Compensating delete: avoid orphaned Keycloak user when DB / role / profile
      // provisioning fails after the KC user was already created.
      try {
        await this.keycloakAdmin.users.del({ id: userId });
      } catch (cleanupErr) {
        console.error('Failed to roll back Keycloak user after signup failure:', cleanupErr);
      }
      throw err;
    }

    const loginReq = new LoginRequest();
    loginReq.username = request.username;
    loginReq.password = request.password;
    return await this.login(loginReq);
  }

  private async createPendingVendorRequestIfNeeded(
    userType: string,
    keycloakUserId: string,
    request: SignUpRequest
  ): Promise<void> {
    if (userType !== 'VENDOR') return;

    const pending = await this.vendorRegistrationRequestRepository.findPendingByEmail(request.email);
    if (pending) return;

    const row = new VendorRegistrationRequest();
    row.requestType = 'signup';
    row.status = 'pending';
    row.payload = {
      source: 'auth-signup',
      userType,
      username: request.username,
      email: request.email,
      firstName: request.firstName ?? null,
      lastName: request.lastName ?? null,
      businessName:
        [request.firstName, request.lastName].filter(Boolean).join(' ').trim() || request.username,
      ownerName:
        [request.firstName, request.lastName].filter(Boolean).join(' ').trim() || request.username,
      keycloakUserId,
      vendorPayload: request.vendorPayload ?? null,
    };
    await this.vendorRegistrationRequestRepository.save(row);
  }

  private async provisionCustomerProfileIfNeeded(
    userType: string,
    keycloakUserId: string,
    request: SignUpRequest
  ): Promise<void> {
    if (userType !== 'CUSTOMER') return;

    const existing = await this.customerProfileRepository.findByKeycloakUserId(keycloakUserId);
    if (existing) return;

    const profile = new CustomerProfile();
    profile.fullName = [request.firstName, request.lastName].filter(Boolean).join(' ').trim() || request.username;
    profile.email = request.email || null;
    profile.phone = null;
    profile.status = 'active';
    profile.occupationId = null;
    profile.keycloakUserId = keycloakUserId;
    const ref = request.referralCode?.trim();
    profile.metadata = ref ? { appliedReferralCode: ref } : null;
    await this.customerProfileRepository.save(profile);
  }

  async login(request: LoginRequest): Promise<AuthResponse> {
    return await this.getToken('password', request.username, request.password, null);
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return await this.getToken('refresh_token', null, null, refreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    const logoutUrl = `${this.serverUrl}/realms/${this.realm}/protocol/openid-connect/logout`;

    const params = new URLSearchParams();
    params.append('refresh_token', refreshToken);
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);

    try {
      const response = await axios.post(
        logoutUrl,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      // Keycloak returns 204 No Content on successful logout
      if (response.status !== 204 && response.status !== 200) {
        throw new Error(`Logout failed - Status: ${response.status}`);
      }
    } catch (error: any) {
      if (error.response) {
        // If token is already invalid/expired, consider it successful logout
        if (error.response.status === 400 || error.response.status === 401) {
          return; // Token already invalid, logout successful
        }
        throw new Error(`Logout failed - Status: ${error.response.status}`);
      }
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  async introspectToken(token: string, tokenType: 'access_token' | 'refresh_token' = 'access_token'): Promise<TokenIntrospectionResponse> {
    const introspectUrl = `${this.serverUrl}/realms/${this.realm}/protocol/openid-connect/token/introspect`;

    const params = new URLSearchParams();
    params.append('token', token);
    params.append('token_type_hint', tokenType);
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);

    try {
      const response: AxiosResponse<any> = await axios.post(
        introspectUrl,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (response.status !== 200) {
        throw new Error(`Token introspection failed - Status: ${response.status}`);
      }

      return new TokenIntrospectionResponse(response.data);
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Token introspection failed - Status: ${error.response.status}`);
      }
      throw new Error(`Token introspection failed: ${error.message}`);
    }
  }

  async forgotPassword(request: ForgotPasswordRequest): Promise<void> {
    // Find user by email. We deliberately do NOT throw on missing user so the
    // caller can always return the same generic 200 response (anti-enumeration).
    const user = await this.userRepository.findByEmail(request.email);
    if (!user || !user.keycloakId) {
      return;
    }

    // Let errors propagate to the route so they can be logged centrally with
    // request context. The route still returns 200 to the client.
    await this.keycloakAdmin.users.executeActionsEmail({
      id: user.keycloakId,
      actions: ['UPDATE_PASSWORD'],
      clientId: this.clientId,
    });
  }

  async changePassword(keycloakUserId: string, request: ChangePasswordRequest): Promise<void> {
    try {
      // Get user details from Keycloak
      const keycloakUser = await this.keycloakAdmin.users.findOne({
        id: keycloakUserId,
      });

      if (!keycloakUser || !keycloakUser.username) {
        throw new Error('User not found in Keycloak');
      }

      // Verify current password by attempting login. The token pair this issues
      // is immediately revoked below so it can't be reused by an attacker.
      let verificationTokens: AuthResponse;
      try {
        verificationTokens = await this.getToken(
          'password',
          keycloakUser.username,
          request.currentPassword,
          null
        );
      } catch (error) {
        throw new Error('Current password is incorrect');
      }

      // Revoke the verification-only refresh token so it doesn't linger for 30 days.
      if (verificationTokens.refreshToken) {
        try {
          await this.logout(verificationTokens.refreshToken);
        } catch (revokeErr) {
          console.error('Failed to revoke password-verification refresh token:', revokeErr);
        }
      }

      // Update password in Keycloak
      await this.keycloakAdmin.users.update(
        { id: keycloakUserId },
        {
          credentials: [
            {
              type: 'password',
              value: request.newPassword,
              temporary: false,
            },
          ],
        }
      );

      // Invalidate every active session for this user so previously-issued
      // access / refresh tokens stop working immediately after the password change.
      try {
        await this.keycloakAdmin.users.logout({ id: keycloakUserId });
      } catch (logoutErr) {
        console.error('Failed to invalidate user sessions after password change:', logoutErr);
      }
    } catch (error: any) {
      if (error.message === 'Current password is incorrect') {
        throw error;
      }
      throw new Error(`Failed to change password: ${error.message}`);
    }
  }

  private async getToken(
    grantType: string,
    username: string | null,
    password: string | null,
    refreshToken: string | null
  ): Promise<AuthResponse> {
    const tokenUrl = `${this.serverUrl}/realms/${this.realm}/protocol/openid-connect/token`;

    const params = new URLSearchParams();
    params.append('grant_type', grantType);
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    if (username) params.append('username', username);
    if (password) params.append('password', password);
    if (refreshToken) params.append('refresh_token', refreshToken);

    try {
      const response: AxiosResponse<TokenResponse> = await axios.post(
        tokenUrl,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (response.status !== 200) {
        throw new Error(`Authentication failed - Status: ${response.status}`);
      }

      const token = response.data;
      if (!token || !token.access_token) {
        throw new Error('Authentication failed - Invalid token response');
      }

      const claims = this.decodeAccessToken(token.access_token);
      const roles = (claims.realm_access?.roles || []).map((r) => String(r).toUpperCase());
      const permissions = this.resolvePermissionsFromClaims(claims, roles);

      return new AuthResponse(
        token.access_token,
        token.refresh_token,
        token.token_type,
        token.expires_in,
        token.refresh_expires_in,
        roles,
        permissions,
        claims.vendor_id ?? null,
        claims.customer_id ?? null
      );
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Authentication failed - Status: ${error.response.status}`);
      }
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  private decodeAccessToken(token: string): AccessTokenClaims {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return {};
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decoded = Buffer.from(payload, 'base64').toString('utf8');
      return JSON.parse(decoded) as AccessTokenClaims;
    } catch {
      return {};
    }
  }

  private resolvePermissionsFromClaims(claims: AccessTokenClaims, roles: string[]): string[] {
    if (Array.isArray(claims.permissions) && claims.permissions.length > 0) {
      return claims.permissions.map((p) => String(p));
    }
    const scopePermissions = String(claims.scope || '')
      .split(' ')
      .map((s) => s.trim())
      .filter(Boolean);
    if (scopePermissions.length > 0) return scopePermissions;

    const derived = new Set<string>();
    for (const role of roles) {
      for (const p of ROLE_PERMISSION_MAP[role] || []) derived.add(p);
    }
    return [...derived];
  }
}

