# P4U Production Server — Deployment Status & Runbook

Last updated: 2026-06-23

This document is the **operator runbook** for the live VPS. Keep it in the `p4u-backend` repo so it survives local machine changes.

---

## Server

| Item | Value |
|------|--------|
| Host | `srv1766037` |
| SSH | `ssh root@187.127.182.11` |
| Base path | `/opt/p4u` |

**Important:** `/opt/p4u` is **not** a git repo. It is a folder with **four separate clones** underneath.

---

## Directory layout on VPS

```text
/opt/p4u/
├── backend/          → https://github.com/PlanextConsole/p4u-backend
├── admin-web/        → https://github.com/PlanextConsole/p4u-admin-web
├── user-web/         → https://github.com/PlanextConsole/p4u-new-user-web
└── vendor-web/       → https://github.com/PlanextConsole/p4u-new-vendor-web
```

Verify each is a git repo:

```bash
ls -la /opt/p4u/backend/.git
ls -la /opt/p4u/admin-web/.git
ls -la /opt/p4u/user-web/.git
ls -la /opt/p4u/vendor-web/.git
```

---

## Public URLs

| App | URL | How it is served |
|-----|-----|------------------|
| User web | https://planext4u.com | Nginx → PM2 `user-web` (port **3000**) |
| Admin web | https://admin.planext4u.com | Nginx static → `/opt/p4u/admin-web/dist` |
| Vendor web | https://vendor.planext4u.com | Nginx → PM2 `vendor-web` (port **3002**) |
| API gateway | https://api.planext4u.com | Nginx → PM2 `gateway` (port **8080**) |

Nginx template: [`deploy/planext4u.nginx.conf`](deploy/planext4u.nginx.conf)

---

## GitHub repos (PlanextConsole)

| VPS folder | GitHub repo | Deploy target |
|------------|-------------|---------------|
| `/opt/p4u/backend` | `PlanextConsole/p4u-backend` | All microservices + gateway |
| `/opt/p4u/admin-web` | `PlanextConsole/p4u-admin-web` | Vite static build → `dist/` |
| `/opt/p4u/user-web` | `PlanextConsole/p4u-new-user-web` | Next.js via PM2 |
| `/opt/p4u/vendor-web` | `PlanextConsole/p4u-new-vendor-web` | Next.js via PM2 |

**Never run** `git pull` from `/opt/p4u` itself — it will fail with *not a git repository*.

---

## Step 1 — Pull latest code (always first)

```bash
cd /opt/p4u/backend && git pull origin main
cd /opt/p4u/admin-web && git pull origin main
cd /opt/p4u/user-web && git pull origin main
cd /opt/p4u/vendor-web && git pull origin main
```

You should see new commits (not only *Already up to date*) when a deploy is needed.

---

## Step 2 — Build backend services (only what changed)

All services live under `/opt/p4u/backend/<service-name>/`.

> Use `npm ci --include=dev` for every build. The VPS runs with
> `NODE_ENV=production`, and plain `npm ci` can omit TypeScript and `@types/*`
> packages, causing TS7016/TS7006 compilation errors. Runtime processes still
> start from the compiled `dist/` output.

| PM2 name | Folder | Port |
|----------|--------|------|
| `discovery` | `p4u-discovery-service` | 8761 |
| `gateway` | `p4u-api-gateway-services` | 8080 |
| `auth` | `auth-management-services` | 8081 |
| `admin` | `admin-management-services` | 8082 |
| `catalog` | `catalog-management-services` | 8083 |
| `content` | `content-management-services` | 8084 |
| `profile` | `profile-management-services` | 8085 |
| `commerce` | `commerce-management-services` | 8086 |
| `payment` | `payment-management-services` | 8087 |
| `notification` | `notification-management-services` | 8088 |
| `vendor` | `vendor-management-services` | 8089 |
| `socio` | `socio-management-services` | 8090 |

### Build one service

```bash
cd /opt/p4u/backend/vendor-management-services
npm ci --include=dev
npm run build
```

### Build several services (example)

```bash
for svc in auth-management-services vendor-management-services catalog-management-services \
  p4u-api-gateway-services content-management-services profile-management-services \
  socio-management-services; do
  echo "=== Building $svc ==="
  cd /opt/p4u/backend/$svc
  npm ci --include=dev
  npm run build
done
```

---

## Step 3 — Restart PM2

List processes:

```bash
pm2 list
```

**Rule:** restart **microservices first**, then **gateway** last.

```bash
# Example after auth + vendor backend changes:
pm2 restart auth vendor catalog content profile socio commerce payment notification admin
pm2 restart gateway
pm2 status
```

### Frontend PM2 apps

```bash
pm2 restart user-web      # planext4u.com
pm2 restart vendor-web    # vendor.planext4u.com
```

Admin web is **static** (no PM2) — rebuild `dist/` and nginx serves it (see Step 4).

### After `.env` changes

```bash
pm2 restart auth --update-env
```

Auth loads `.env` from `/opt/p4u/backend/auth-management-services` via `dotenv/config` in code. Working directory must be that folder.

---

## Step 4 — Build frontends

### Admin web (static)

```bash
cd /opt/p4u/admin-web
git pull origin main
export VITE_API_GATEWAY_URL=https://api.planext4u.com
npm ci --include=dev
npm run build
# Output: /opt/p4u/admin-web/dist  (nginx root)
```

Env template: [`deploy/admin-web.env.production`](deploy/admin-web.env.production)

### User web (Next.js)

```bash
cd /opt/p4u/user-web
git pull origin main
npm ci --include=dev
npm run build
pm2 restart user-web
```

Ensure production env sets `NEXT_PUBLIC_API_GATEWAY_URL=https://api.planext4u.com`.

### Vendor web (Next.js)

```bash
cd /opt/p4u/vendor-web
git pull origin main
npm ci --include=dev
npm run build
pm2 restart vendor-web
```

Env template: [`deploy/vendor-web.env.production`](deploy/vendor-web.env.production)

---

## Step 5 — Verify

### Gateway

```bash
curl -s http://127.0.0.1:8080/health
```

### Public API

```bash
curl -s https://api.planext4u.com/health
curl -s "https://api.planext4u.com/api/v1/catalog/browse/products?limit=1"
```

### Keycloak (Docker)

```bash
docker ps | grep keycloak
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8180/
```

### PM2 logs (when something fails)

```bash
pm2 logs auth --lines 80
pm2 logs gateway --lines 50
pm2 logs vendor --lines 50
```

---

## Production environment notes

### JWT issuer (all JWT-validating services)

Keycloak tokens use `iss=http://localhost:8180/realms/p4u-realm` even when API calls use `127.0.0.1:8180`.

Add to **every** backend service `.env` that validates JWTs:

```env
JWT_ISSUER_URI=http://localhost:8180/realms/p4u-realm
```

Snippet: [`deploy/backend-jwt.production.snippet`](deploy/backend-jwt.production.snippet)

### Auth service Keycloak

```bash
grep -E '^KEYCLOAK_|^JWT_|^FIREBASE_' /opt/p4u/backend/auth-management-services/.env
```

After editing `.env`:

```bash
pm2 restart auth --update-env
```

### Upload / image URLs

Admin uploads must be stored as **gateway-relative** paths (`/uploads/...`), not `http://127.0.0.1:8082/...`, or user/vendor browsers will show broken images.

### Persistent file storage (production)

Uploaded files must survive `git pull`, rebuilds, and PM2 restarts. They live **outside** the git clone:

```text
/opt/p4u/storage/admin-uploads    ← admin images, media library
/opt/p4u/storage/vendor-uploads   ← vendor product / service / KYC documents
/opt/p4u/storage/socio-uploads    ← socio post & story photos/videos
/opt/p4u/backups/                 ← daily tar.gz of /opt/p4u/storage
```

**One-time setup** (after pulling backend with `deploy/setup-persistent-storage.sh`):

```bash
cd /opt/p4u/backend && git pull origin main
bash deploy/setup-persistent-storage.sh
```

This creates storage dirs, symlinks:

- `admin-management-services/uploads` → `/opt/p4u/storage/admin-uploads`
- `vendor-management-services/uploads` → `/opt/p4u/storage/vendor-uploads`
- `socio-management-services/uploads` → `/opt/p4u/storage/socio-uploads`

…and installs a daily backup cron (`deploy/backup-p4u-storage.sh`, retains 14 days).

Optional `.env` overrides (symlinks alone are enough):

```env
# admin-management-services/.env
UPLOAD_DIR=/opt/p4u/storage/admin-uploads

# vendor-management-services/.env
UPLOAD_DIR=/opt/p4u/storage/vendor-uploads

# socio-management-services/.env
UPLOAD_DIR=/opt/p4u/storage/socio-uploads
```

After setup or upload-path code changes:

```bash
cd /opt/p4u/backend/admin-management-services && npm ci --include=dev && npm run build
cd /opt/p4u/backend/vendor-management-services && npm ci --include=dev && npm run build
cd /opt/p4u/backend/socio-management-services && npm ci --include=dev && npm run build
pm2 restart admin vendor socio gateway
pm2 save
```

**Verify:**

```bash
# Admin upload appears on disk
ls -la /opt/p4u/storage/admin-uploads/

# Public URL via gateway (replace filename)
curl -sI "https://api.planext4u.com/uploads/<filename>"

# Vendor upload
ls -la /opt/p4u/storage/vendor-uploads/
curl -sI "https://api.planext4u.com/vendor-uploads/<filename>"

# Socio post/story media (replace id)
ls -la /opt/p4u/storage/socio-uploads/media/
curl -sI "https://api.planext4u.com/socio-uploads/media/<id>"
```

On first socio service start after deploy, legacy `social_media.data` blobs are auto-migrated to disk and cleared from MySQL.

---

## Common deploy scenarios

### Backend-only fix (e.g. auth, vendor API)

```bash
cd /opt/p4u/backend && git pull origin main
cd /opt/p4u/backend/auth-management-services && npm ci --include=dev && npm run build
cd /opt/p4u/backend/vendor-management-services && npm ci --include=dev && npm run build
pm2 restart auth vendor
pm2 restart gateway
```

### Admin UI only

```bash
cd /opt/p4u/admin-web && git pull origin main
export VITE_API_GATEWAY_URL=https://api.planext4u.com
npm ci --include=dev && npm run build
# nginx picks up dist/ automatically
```

### User / vendor session or auth UI

```bash
cd /opt/p4u/user-web && git pull origin main && npm ci --include=dev && npm run build && pm2 restart user-web
cd /opt/p4u/vendor-web && git pull origin main && npm ci --include=dev && npm run build && pm2 restart vendor-web
```

### Full stack release

```bash
cd /opt/p4u/backend && git pull origin main
cd /opt/p4u/admin-web && git pull origin main
cd /opt/p4u/user-web && git pull origin main
cd /opt/p4u/vendor-web && git pull origin main

# Build all touched backend services (see Step 2), then:
pm2 restart discovery auth admin catalog content profile commerce payment notification vendor socio
pm2 restart gateway

export VITE_API_GATEWAY_URL=https://api.planext4u.com
cd /opt/p4u/admin-web && npm ci --include=dev && npm run build
cd /opt/p4u/user-web && npm ci --include=dev && npm run build && pm2 restart user-web
cd /opt/p4u/vendor-web && npm ci --include=dev && npm run build && pm2 restart vendor-web
```

---

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `fatal: not a git repository` in `/opt/p4u` | Pulled wrong directory | `cd` into `backend`, `admin-web`, `user-web`, or `vendor-web` |
| `tsc` errors on `vendor.routes.ts` / `vendorPortal.service.ts` | Old backend without `1eece02+` | `cd /opt/p4u/backend && git pull origin main` then rebuild `vendor-management-services` |
| `503` on phone login | Keycloak / auth `.env` | Test Keycloak token endpoint; `pm2 restart auth --update-env` |
| Infinite `/refresh` 401 on user/vendor web | Stale tokens + old frontend build | Deploy latest user/vendor web; user clears site data and logs in again |
| Broken product images | `127.0.0.1` in `thumbnailUrl` | Deploy backend upload-url fix; re-save or migrate URLs |
| `admin` PM2 high restart count | Runtime crash loop | `pm2 logs admin --lines 100` |

### Keycloak quick test

```bash
source /opt/p4u/backend/auth-management-services/.env
curl -s -X POST "http://127.0.0.1:8180/realms/p4u-realm/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${KEYCLOAK_CLIENT_ID}&client_secret=${KEYCLOAK_CLIENT_SECRET}"
```

Should return `access_token` JSON, not `error`.

---

## Related docs in this repo

| File | Purpose |
|------|---------|
| [`SETUP-GUIDE.md`](SETUP-GUIDE.md) | Local dev (Docker, ports, health curls) |
| [`PROD-VALIDATION-CHECKLIST.md`](PROD-VALIDATION-CHECKLIST.md) | Post-deploy smoke tests |
| [`deploy/`](deploy/) | Nginx + production env snippets |
| [`GITHUB-REPOS-AND-ACTIONS.md`](GITHUB-REPOS-AND-ACTIONS.md) | How to publish new PlanextConsole repos |

---

## Recent production fixes (reference)

| Date | Repo | Notes |
|------|------|-------|
| 2026-06 | `p4u-backend` | Multi-issuer JWT + vendor phone fallback (`e40d461`); restore settlement/rating methods (`1eece02`) |
| 2026-06 | `p4u-new-user-web` | Customer auth refresh loop fix (`153566f`) |
| 2026-06 | `p4u-admin-web` | Admin logo + vendor list actions (`ca85a2a`) |
| 2026-06 | `p4u-new-vendor-web` | Vendor login after approval (`d594562`) |

---

*When in doubt: pull in each repo folder → build what changed → restart only those PM2 processes → curl `/health`.*
