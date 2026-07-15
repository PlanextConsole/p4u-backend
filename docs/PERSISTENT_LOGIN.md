# Persistent Login ("stay logged in until Logout")

Goal: once a user logs in, they stay logged in **indefinitely** — across browser
refresh, tab/browser close & reopen, app restart, device reboot, and
background/foreground — and are **only** logged out when they explicitly tap/click
**Logout**. This matches the Amazon/Flipkart experience.

## TL;DR — what actually needed changing

The **clients were already built for persistent login.** The real limiter was a
**Keycloak configuration** issue, plus two small mobile hardening fixes.

| Layer | State before | Action |
|---|---|---|
| Web (user + vendor, Next.js) | Tokens in `localStorage`; silent refresh; refresh failure does **not** clear storage; only Logout clears. | ✅ No change needed. |
| Mobile (customer + vendor, Flutter) | Tokens in `shared_preferences` (on disk); auto-restore on launch; silent refresh; only Logout clears. | ✅ Persistence fine. Two small hardening fixes applied (below). |
| Auth backend (`auth-management-services`) | Keycloak-fronted; already requests `scope=openid offline_access`; has `/public/refresh` + `/logout`. | ✅ No code change needed. |
| **Keycloak realm/client** | Offline session idle default (~30 days); `offline_access` scope maybe not attached to the client. | ⚠️ **Configure — this was the real gap.** |

## Why Keycloak is the real lever

The auth service does **not** sign its own access tokens — it delegates to
**Keycloak** (OIDC password/refresh grants). So token lifetimes are controlled by
Keycloak realm/client settings, **not** by any value in this repo.

Two Keycloak facts determine how long a session lasts:

1. **`offline_access` scope must be attached to the auth client.** The code already
   sends `scope=openid offline_access` (`auth-management-services/src/service/authService.ts`
   and `phoneAuthService.ts`). If the client doesn't expose `offline_access` as a
   default/optional client scope, Keycloak **silently ignores** it and issues an
   ordinary refresh token tied to the online SSO session (short-lived).
2. **Offline session timeouts.** An *offline* refresh token lives as long as the
   realm's **Offline Session Idle** window (default 30 days), unless an **Offline
   Session Max** cap is enabled. The idle window **resets every time the token is
   used to refresh**, so a large idle value = effectively indefinite for any user
   who opens the app within that window.

## How to apply

### Option A — run the script (recommended)

Local dev (Keycloak in the `p4u_keycloak` docker-compose container):

```bash
bash scripts/keycloak/configure-persistent-login.sh
```

Against a remote/prod Keycloak (with `kcadm.sh` available locally):

```bash
KC_MODE=local \
KC_SERVER=https://auth.planext4u.com \
KC_REALM=p4u-realm \
KC_CLIENT_ID=auth-management-client \
KC_ADMIN=admin KC_ADMIN_PASSWORD='****' \
bash scripts/keycloak/configure-persistent-login.sh
```

The script is **idempotent**. It sets `offlineSessionIdleTimeout` to 10 years,
disables the offline max-lifespan cap, widens the online SSO timeouts, and attaches
`offline_access` as a default client scope. Tune the numbers via the `OFFLINE_IDLE`
/ `SSO_IDLE` / `SSO_MAX` env vars.

### Option B — Keycloak admin console (manual)

1. **Realm settings → Sessions**
   - *SSO Session Idle* / *SSO Session Max*: set large (e.g. 10 years) or per policy.
   - *Offline Session Idle*: set large (e.g. `3650` days). This is the key one.
   - *Offline Session Max Limited*: **Off** (so offline sessions have no hard cap).
   - Save.
2. **Clients → `auth-management-client` → Client scopes**
   - Ensure `offline_access` is listed with **Assigned type = Default** (add it if missing).

> Existing already-issued tokens keep their old (short) lifetime. Users pick up the
> new long-lived tokens the next time they log in.

## The two mobile hardening fixes (applied in this change)

These are in the Flutter apps; they make persistence more robust but are not the
main lever.

1. **Vendor app cold-start login flash.** `planext-vendor-app` started at `/login`
   and relied on a listener to bounce an already-logged-in vendor to the dashboard,
   causing a brief login-screen flash on launch. Added a splash gate
   (`lib/src/features/auth/presentation/splash_gate.dart`) as the initial route that
   resolves the persisted session first, then routes to `/` (logged in) or `/login`.
   The customer app already avoided this (it starts on a public home screen).

2. **Don't drop the session on a transient `403`.** In both apps'
   `auth_repository.dart`, `currentVendor()` / `currentCustomer()` previously cleared
   the whole session on `401` **or** `403` from the profile fetch. A `401` only
   reaches that code after a failed silent refresh (session genuinely dead) — so
   clearing on `401` is correct. A `403` is a live-token *authorization* problem, not
   an expiry, so it no longer logs the user out; it falls back to the cached profile.

## How to verify end-to-end

1. Run the Keycloak script/config above.
2. Log in on each client, then confirm the session survives:
   - **Web:** hard refresh, close & reopen the tab, restart the browser → still logged in.
     Check `localStorage` still holds `p4u_token` / `p4u_refresh_token` (user) or
     `p4u_vendor_token` / `p4u_vendor_refresh_token` (vendor).
   - **Mobile:** kill & relaunch the app, reboot the device, background/foreground →
     lands on home/dashboard without the login screen.
3. Confirm the returned refresh token is an **offline** token: decode the JWT and
   check `"typ": "Offline"` (offline tokens have no `exp`, only the offline-session
   idle applies).
4. Tap/click **Logout** → tokens cleared locally and the offline session is revoked
   at Keycloak (`POST /logout`). A subsequent refresh attempt fails → user is on login.

## Security note

"Indefinite until logout" means a stolen refresh token is valid for a long time.
Mitigations already in place / available:
- Logout revokes the offline session server-side (`/logout` → Keycloak OIDC logout).
- Changing password kills all sessions (`authService.changePassword` → `users.logout`).
- Keep Keycloak's *Revoke Refresh Token* (rotation) enabled so each refresh
  invalidates the previous token; the clients already store the rotated token on
  every refresh.
