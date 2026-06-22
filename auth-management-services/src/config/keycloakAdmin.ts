import KcAdminClient from '@keycloak/keycloak-admin-client';

/**
 * KEYCLOAK ADMIN CLIENT CONFIGURATION
 *
 * Keycloak service-account tokens expire (~300s). We refresh before expiry so
 * phone signup / user creation does not fail with HTTP 401 after auth has been
 * running for a few minutes.
 */

const AUTH_REFRESH_MS = 4 * 60 * 1000;
let lastAuthAt = 0;

function keycloakAuthConfig() {
  return {
    grantType: 'client_credentials' as const,
    clientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'auth-management-client',
    clientSecret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET || '',
  };
}

export async function ensureKeycloakAdminAuth(client: KcAdminClient): Promise<void> {
  if (Date.now() - lastAuthAt < AUTH_REFRESH_MS) return;
  await client.auth(keycloakAuthConfig());
  client.setConfig({
    realmName: process.env.KEYCLOAK_REALM || 'p4u-realm',
  });
  lastAuthAt = Date.now();
}

export const getKeycloakAdminClient = async (): Promise<KcAdminClient> => {
  const kcAdminClient = new KcAdminClient({
    baseUrl: process.env.KEYCLOAK_SERVER_URL || 'http://localhost:8180',
    realmName: process.env.KEYCLOAK_REALM || 'p4u-realm',
  });

  await ensureKeycloakAdminAuth(kcAdminClient);

  return kcAdminClient;
};
