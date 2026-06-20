import KcAdminClient from '@keycloak/keycloak-admin-client';

/**
 * KEYCLOAK ADMIN CLIENT CONFIGURATION
 * 
 * This file configures the Keycloak Admin Client used for user management.
 * 
 * To change Keycloak settings, use environment variables:
 * - KEYCLOAK_SERVER_URL: Keycloak server URL (default: http://localhost:8180)
 * - KEYCLOAK_REALM: Keycloak realm name (default: p4u-realm)
 * - KEYCLOAK_ADMIN_CLIENT_ID: Admin client ID (default: auth-management-client)
 * - KEYCLOAK_ADMIN_CLIENT_SECRET: Admin client secret
 * 
 * Example (Windows PowerShell):
 *   $env:KEYCLOAK_SERVER_URL="http://localhost:8180"
 *   $env:KEYCLOAK_REALM="my-realm"
 *   $env:KEYCLOAK_ADMIN_CLIENT_ID="my-client"
 *   $env:KEYCLOAK_ADMIN_CLIENT_SECRET="my-secret"
 */
export const getKeycloakAdminClient = async (): Promise<KcAdminClient> => {
  const kcAdminClient = new KcAdminClient({
    baseUrl: process.env.KEYCLOAK_SERVER_URL || 'http://localhost:8180',  // Keycloak server URL
    realmName: process.env.KEYCLOAK_REALM || 'p4u-realm',                    // Keycloak realm
  });

  await kcAdminClient.auth({
    grantType: 'client_credentials',
    clientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'auth-management-client',  // Admin client ID
    clientSecret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET || '',                 // Admin client secret
  });

  kcAdminClient.setConfig({
    realmName: process.env.KEYCLOAK_REALM || 'p4u-realm',
  });

  return kcAdminClient;
};

