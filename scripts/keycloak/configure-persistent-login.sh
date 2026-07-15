#!/usr/bin/env bash
#
# configure-persistent-login.sh
# -----------------------------------------------------------------------------
# Configures Keycloak so that logged-in users stay logged in *indefinitely*
# until they explicitly log out (Amazon/Flipkart-style), by:
#
#   1. Setting the realm's OFFLINE session idle timeout to effectively-infinite
#      and disabling the offline session absolute (max) lifespan cap.
#   2. (Optional, recommended) widening the online SSO session timeouts too.
#   3. Ensuring the `offline_access` client scope is a DEFAULT scope on the
#      auth client, so the `scope=openid offline_access` that the auth service
#      already requests is actually honoured (otherwise Keycloak silently drops
#      it and issues an ordinary, short-lived refresh token).
#
# The P4U clients (web + Flutter) already persist the refresh token on disk and
# silently refresh the access token, so once Keycloak issues a long-lived
# OFFLINE refresh token, login survives refresh / restart / reboot until the
# user taps Logout (which revokes the offline session server-side).
#
# This script is idempotent — safe to run repeatedly.
#
# -----------------------------------------------------------------------------
# Usage:
#
#   # Local dev (Keycloak running in the docker-compose container "p4u_keycloak"):
#   bash scripts/keycloak/configure-persistent-login.sh
#
#   # Against a remote/prod Keycloak (kcadm.sh on PATH or KCADM set):
#   KC_MODE=local KC_SERVER=https://auth.example.com KC_REALM=p4u-realm \
#     KC_ADMIN=admin KC_ADMIN_PASSWORD=*** \
#     bash scripts/keycloak/configure-persistent-login.sh
#
# Environment variables (all have sensible defaults for local dev):
#   KC_MODE          docker | local   (default: docker — exec kcadm.sh in a container)
#   KC_CONTAINER     docker container name             (default: p4u_keycloak)
#   KCADM            path to kcadm.sh when KC_MODE=local (default: kcadm.sh)
#   KC_SERVER        Keycloak base URL                 (default: http://localhost:8180)
#   KC_REALM         target realm                      (default: p4u-realm)
#   KC_CLIENT_ID     auth client id                    (default: auth-management-client)
#   KC_ADMIN         admin username                    (default: admin)
#   KC_ADMIN_PASSWORD admin password                   (default: admin)
#   KC_ADMIN_REALM   realm to authenticate against     (default: master)
#   OFFLINE_IDLE     offline session idle timeout, sec (default: 315360000 = 10 years)
#   SSO_IDLE         online SSO idle timeout, sec       (default: 315360000)
#   SSO_MAX          online SSO max lifespan, sec       (default: 315360000)
# -----------------------------------------------------------------------------

set -euo pipefail

KC_MODE="${KC_MODE:-docker}"
KC_CONTAINER="${KC_CONTAINER:-p4u_keycloak}"
KCADM="${KCADM:-kcadm.sh}"
KC_SERVER="${KC_SERVER:-http://localhost:8180}"
KC_REALM="${KC_REALM:-p4u-realm}"
KC_CLIENT_ID="${KC_CLIENT_ID:-auth-management-client}"
KC_ADMIN="${KC_ADMIN:-admin}"
KC_ADMIN_PASSWORD="${KC_ADMIN_PASSWORD:-admin}"
KC_ADMIN_REALM="${KC_ADMIN_REALM:-master}"

# 10 years ~= "indefinite" for a session that refreshes on every app open.
# Offline session idle is reset every time the offline refresh token is used,
# so any user who opens the app within this window never gets logged out.
OFFLINE_IDLE="${OFFLINE_IDLE:-315360000}"
SSO_IDLE="${SSO_IDLE:-315360000}"
SSO_MAX="${SSO_MAX:-315360000}"

log() { printf '\033[36m[persistent-login]\033[0m %s\n' "$*"; }
die() { printf '\033[31m[persistent-login] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# kc <args...> — run kcadm.sh either inside the container or locally.
kc() {
  if [ "$KC_MODE" = "docker" ]; then
    docker exec -i "$KC_CONTAINER" /opt/keycloak/bin/kcadm.sh "$@"
  else
    "$KCADM" "$@"
  fi
}

# ---------------------------------------------------------------------------
# 0. Preconditions
# ---------------------------------------------------------------------------
if [ "$KC_MODE" = "docker" ]; then
  command -v docker >/dev/null 2>&1 || die "docker not found on PATH (needed for KC_MODE=docker)."
  docker inspect "$KC_CONTAINER" >/dev/null 2>&1 \
    || die "container '$KC_CONTAINER' not running. Start it (docker compose up -d keycloak) or set KC_MODE=local."
fi

# ---------------------------------------------------------------------------
# 1. Authenticate kcadm
# ---------------------------------------------------------------------------
log "Authenticating to $KC_SERVER (realm=$KC_ADMIN_REALM, user=$KC_ADMIN)…"
kc config credentials \
  --server "$KC_SERVER" \
  --realm "$KC_ADMIN_REALM" \
  --user "$KC_ADMIN" \
  --password "$KC_ADMIN_PASSWORD" \
  || die "kcadm login failed. Check KC_SERVER / KC_ADMIN / KC_ADMIN_PASSWORD."

# ---------------------------------------------------------------------------
# 2. Realm session timeouts
# ---------------------------------------------------------------------------
log "Updating realm '$KC_REALM' session timeouts…"
log "  offlineSessionIdleTimeout      = ${OFFLINE_IDLE}s"
log "  offlineSessionMaxLifespanEnabled = false (no absolute cap on offline sessions)"
log "  ssoSessionIdleTimeout          = ${SSO_IDLE}s"
log "  ssoSessionMaxLifespan          = ${SSO_MAX}s"

kc update "realms/$KC_REALM" \
  -s "offlineSessionIdleTimeout=$OFFLINE_IDLE" \
  -s "offlineSessionMaxLifespanEnabled=false" \
  -s "ssoSessionIdleTimeout=$SSO_IDLE" \
  -s "ssoSessionMaxLifespan=$SSO_MAX" \
  || die "Failed to update realm session settings."

# ---------------------------------------------------------------------------
# 3. Ensure offline_access is a DEFAULT client scope on the auth client
# ---------------------------------------------------------------------------
log "Resolving client '$KC_CLIENT_ID' in realm '$KC_REALM'…"
CLIENT_UUID="$(kc get clients -r "$KC_REALM" -q "clientId=$KC_CLIENT_ID" --fields id --format csv --noquotes | head -n1 | tr -d '\r')"
[ -n "$CLIENT_UUID" ] || die "Client '$KC_CLIENT_ID' not found in realm '$KC_REALM'."
log "  client uuid = $CLIENT_UUID"

log "Resolving 'offline_access' client scope id…"
# client-scopes has no -q filter; list id+name as CSV and pick the offline_access row.
SCOPE_ROW="$(kc get client-scopes -r "$KC_REALM" --fields id,name --format csv --noquotes | tr -d '\r' | grep -i ',offline_access$' || true)"
OFFLINE_SCOPE_ID="${SCOPE_ROW%%,*}"
[ -n "$OFFLINE_SCOPE_ID" ] || die "Built-in 'offline_access' client scope not found in realm '$KC_REALM'."
log "  offline_access scope id = $OFFLINE_SCOPE_ID"

log "Attaching 'offline_access' as a DEFAULT client scope on '$KC_CLIENT_ID' (idempotent)…"
# PUT is idempotent: re-adding an already-default scope is a no-op 204.
kc update "clients/$CLIENT_UUID/default-client-scopes/$OFFLINE_SCOPE_ID" -r "$KC_REALM" \
  || die "Failed to attach offline_access as a default client scope."

# ---------------------------------------------------------------------------
# 4. Verify
# ---------------------------------------------------------------------------
log "Verifying realm settings…"
kc get "realms/$KC_REALM" \
  --fields offlineSessionIdleTimeout,offlineSessionMaxLifespanEnabled,ssoSessionIdleTimeout,ssoSessionMaxLifespan

log "Verifying client default scopes include offline_access…"
kc get "clients/$CLIENT_UUID/default-client-scopes" -r "$KC_REALM" --fields name

log "Done. New logins will receive long-lived OFFLINE refresh tokens."
log "NOTE: existing sessions keep their old (short) tokens until the user logs in again."
