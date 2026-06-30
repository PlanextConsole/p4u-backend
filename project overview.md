# P4U Project Overview

## 1. What This Project Is

P4U / Planext4u is a multi-application, microservice-based platform. It contains backend services, an API gateway, service discovery, and three web applications for different user groups.

The platform supports:

- Customer-facing web application
- Admin dashboard
- Vendor portal for product vendors
- Vendor portal for service vendors
- Authentication and onboarding
- Catalog, product, service, order, booking, payment, settlement, notification, profile, and social/content flows

The local project path is:

```text
C:\Users\Kumareson\OneDrive\briefcase\P4U-New
```

The production server layout uses separate clones under:

```text
/opt/p4u/
```

## 2. Repository Layout

This local folder contains several projects together:

```text
P4U-New/
  auth-management-services/
  admin-management-services/
  catalog-management-services/
  commerce-management-services/
  content-management-services/
  notification-management-services/
  payment-management-services/
  profile-management-services/
  socio-management-services/
  vendor-management-services/
  p4u-api-gateway-services/
  p4u-discovery-service/
  p4u-admin-web/
  p4u-new-user-web/
  p4u-new-vendor-web/
  deploy/
  docs/
  docker-compose.yml
  SERVER-DEPLOYMENT-STATUS.md
```

Important note: the parent folder may ignore nested frontend projects in `.gitignore`. The web apps can have their own `.git` repositories. For example, vendor web changes should be committed from:

```text
P4U-New\p4u-new-vendor-web
```

## 3. High-Level Architecture

The system follows this flow:

```text
Customer Web / Admin Web / Vendor Web
        |
        v
API Gateway
        |
        v
Service Discovery
        |
        v
Target Backend Microservice
        |
        v
MySQL / Keycloak / Firebase / File Storage / External Payment Provider
```

The frontend apps do not directly call every backend service. They generally call the API gateway. The gateway routes the request to the correct backend service.

## 4. Core Technology Stack

Backend stack:

- Node.js
- TypeScript
- Express
- TypeORM
- MySQL
- Keycloak
- Firebase Admin
- JWT / JWKS authentication
- PM2 in production
- Nginx in production

Frontend stack:

- Admin web: React + Vite
- User web: Next.js
- Vendor web: Next.js
- Tailwind CSS
- Radix UI in the Next.js apps
- Lucide icons in vendor/user apps

Infrastructure and deployment:

- VPS server
- PM2 process manager
- Nginx reverse proxy
- Keycloak Docker container
- Persistent upload storage outside git clones

## 5. Public Production URLs

From `SERVER-DEPLOYMENT-STATUS.md`:

| Application | URL | Served By |
|---|---|---|
| User web | `https://planext4u.com` | Nginx to PM2 `user-web`, port `3000` |
| Admin web | `https://admin.planext4u.com` | Nginx static files from admin `dist/` |
| Vendor web | `https://vendor.planext4u.com` | Nginx to PM2 `vendor-web`, port `3002` |
| API gateway | `https://api.planext4u.com` | Nginx to PM2 `gateway`, port `8080` |

## 6. Backend Services And Ports

| Service | Folder | PM2 Name | Port | Purpose |
|---|---|---:|---:|---|
| Discovery | `p4u-discovery-service` | `discovery` | `8761` | Service registry and health tracking |
| Gateway | `p4u-api-gateway-services` | `gateway` | `8080` | Routes API requests to services |
| Auth | `auth-management-services` | `auth` | `8081` | Login, signup, token, Keycloak, Firebase phone auth |
| Admin | `admin-management-services` | `admin` | `8082` | Admin dashboard APIs |
| Catalog | `catalog-management-services` | `catalog` | `8083` | Public catalog/product/service queries |
| Content | `content-management-services` | `content` | `8084` | Banners, posts, website content |
| Profile | `profile-management-services` | `profile` | `8085` | Customer profile, address, wishlist, referrals |
| Commerce | `commerce-management-services` | `commerce` | `8086` | Cart, orders, bookings, coupons, reviews, pricing |
| Payment | `payment-management-services` | `payment` | `8087` | Payment intents and webhooks |
| Notification | `notification-management-services` | `notification` | `8088` | Notifications and device tokens |
| Vendor | `vendor-management-services` | `vendor` | `8089` | Vendor portal APIs |
| Socio | `socio-management-services` | `socio` | `8090` | Social feed/posts/stories |

## 7. Service Discovery Flow

The discovery service maintains an in-memory registry of services.

Each backend service should:

1. Start its Express server.
2. Connect to database if needed.
3. Register itself with discovery.
4. Send heartbeats.
5. Deregister on shutdown.

Gateway uses discovery to locate healthy service instances and forward API requests.

Discovery service endpoints include:

```http
GET    /health
POST   /eureka/apps/:serviceName
DELETE /eureka/apps/:serviceName/:instanceId
PUT    /eureka/apps/:serviceName/:instanceId
GET    /eureka/apps
GET    /eureka/apps/:serviceName
GET    /status
```

## 8. API Gateway Flow

The gateway is the main API entry point.

Important gateway route mappings:

| Gateway Path | Target Service |
|---|---|
| `/api/auth/*` | Auth service |
| `/api/admin/*` | Admin service |
| `/uploads/*` | Admin service upload files |
| `/api/v1/catalog/*` | Catalog service |
| `/api/v1/content/*` | Content service |
| `/api/v1/profile/*` | Profile service |
| `/api/v1/commerce/*` | Commerce service |
| `/api/v1/payments/*` | Payment service |
| `/api/v1/notifications/*` | Notification service |
| `/api/v1/vendor/*` | Vendor service |
| `/vendor-uploads/*` | Vendor service upload files |
| `/api/v1/social/*` | Socio service |
| `/socio-uploads/*` | Socio service upload files |

Example request flow:

```text
Vendor web calls /api/v1/vendor/me
        |
Gateway receives request
        |
Gateway asks discovery for vendor-management-service
        |
Gateway proxies request to vendor service
        |
Vendor service returns profile data
        |
Gateway returns response to vendor web
```

## 9. Authentication And Authorization Flow

Authentication is mainly handled by `auth-management-services` using Keycloak.

Auth responsibilities:

- Customer signup
- Vendor signup
- Login
- Refresh token
- Logout
- Phone OTP exchange through Firebase
- Vendor register-by-phone
- Keycloak role integration
- Token introspection and JWT validation support

Important auth routes include:

```http
GET  /api/auth/public/health
POST /api/auth/public/signup
POST /api/auth/public/login
POST /api/auth/public/refresh
POST /api/auth/public/phone/exchange
POST /api/auth/public/vendor/register-by-phone
POST /api/auth/logout
POST /api/auth/change-password
GET  /api/auth/vendor/me/onboarding
POST /api/auth/vendor/me/onboarding
```

Key auth dependencies:

- Keycloak realm: `p4u-realm`
- Keycloak service URL in local/docker setup: `http://localhost:8180`
- MySQL database: usually `p4u_admin_db`
- Firebase Admin for phone auth

## 10. Admin Flow

Admin web is located in:

```text
p4u-admin-web/
```

Admin backend is located in:

```text
admin-management-services/
```

Admin API prefix:

```http
/api/admin
```

Admin handles:

- Admin dashboard data
- Vendors
- Vendor requests
- Vendor enquiries
- Customers
- Coupons
- Occupations
- Categories
- Services
- Products
- Tax configuration
- Product requests
- Orders
- Settlements
- Organization orders
- Platform variables
- Website queries
- Banners
- Popup banners
- Posts and feed moderation
- Vendor reviews
- Classified module
- POS module
- Analytics
- File uploads
- Media library

Admin routes require Keycloak admin JWT with the `ADMIN` role, except explicitly public routes such as health and published layout reads.

Important admin docs:

```text
admin-management-services/docs/API-FULL-LIST.md
admin-management-services/src/modules/MODULES.md
```

## 11. Customer/User Web Flow

User web is located in:

```text
p4u-new-user-web/
```

It is a Next.js application.

Customer-facing responsibilities include:

- Home page and content display
- Catalog browsing
- Product browsing
- Service browsing
- Customer authentication
- Profile flow
- Cart and checkout
- Booking services
- Order placement
- Payments
- Social/content display depending on active features

Common backend services used by customer web:

- Auth service
- Catalog service
- Content service
- Profile service
- Commerce service
- Payment service
- Notification service
- Socio service

## 12. Vendor Web Flow

Vendor web is located in:

```text
p4u-new-vendor-web/
```

It supports two vendor types:

- Product vendor
- Service vendor

After login/onboarding, routing depends on vendor type:

```text
PRODUCT vendor -> /dashboard/product
SERVICE vendor -> /dashboard/service
```

The shell redirects vendors away from the wrong dashboard type. A service vendor should not use product pages, and a product vendor should not use service pages.

## 13. Product Vendor Flow

Product vendor dashboard root:

```http
/dashboard/product
```

Product vendor sidebar includes:

- Dashboard
- Products
- Orders
- Dropshipping
- Settlements
- Payment History
- Bank Account
- Profile & Settings
- Media Library
- KYC Verification

Product vendor main flows:

1. Vendor logs in.
2. Vendor lands on product dashboard.
3. Vendor manages products.
4. Customer places orders.
5. Vendor views product orders.
6. Vendor updates order status.
7. Settlement records are created from commerce/order flow.
8. Admin processes payout/settlement.
9. Vendor views settlements and payment history.

Product vendor APIs include:

```http
GET    /api/v1/vendor/me
PATCH  /api/v1/vendor/me
GET    /api/v1/vendor/me/products
GET    /api/v1/vendor/me/products/:productId
POST   /api/v1/vendor/me/products
PATCH  /api/v1/vendor/me/products/:productId
DELETE /api/v1/vendor/me/products/:productId
GET    /api/v1/vendor/orders
GET    /api/v1/vendor/orders/:orderId
PATCH  /api/v1/vendor/orders/:orderId
GET    /api/v1/vendor/me/settlements
POST   /api/v1/vendor/me/upload
```

Orders are for product vendors only.

## 14. Service Vendor Flow

Service vendor dashboard root:

```http
/dashboard/service
```

Service vendor sidebar includes:

- Dashboard
- Services
- Availability
- Bookings
- Settlements
- Payment History
- Bank Account
- Profile & Settings
- Media Library
- KYC Verification

Service vendor main flows:

1. Vendor logs in.
2. Vendor lands on service dashboard.
3. Vendor creates or links service offerings.
4. Vendor configures booking availability.
5. Customer books a service.
6. Booking appears in service vendor bookings page.
7. Vendor approves, rejects, starts, completes, or cancels booking depending on backend support.
8. Booking revenue is displayed in dashboard and profile.
9. Settlements/payment history are tracked separately.

Important service vendor APIs include:

```http
GET    /api/v1/vendor/me
PATCH  /api/v1/vendor/me
GET    /api/v1/vendor/me/vendor-services
POST   /api/v1/vendor/me/vendor-services
PATCH  /api/v1/vendor/me/vendor-services/:linkId
DELETE /api/v1/vendor/me/vendor-services/:linkId
GET    /api/v1/vendor/me/booking-availability
PUT    /api/v1/vendor/me/booking-availability
GET    /api/v1/vendor/bookings
GET    /api/v1/vendor/bookings/:bookingId
PATCH  /api/v1/vendor/bookings/:bookingId
GET    /api/v1/vendor/me/settlements
```

Service vendors should see bookings, not product orders.

Recent fix made in vendor web:

- Product profile performance uses product orders.
- Service profile performance uses service bookings.
- Service profile shows `Bookings`, not `Orders`.
- Service profile revenue sums booking amount.
- Service dashboard says `Active Bookings`, not `Active Orders`.

## 15. Booking Flow

Booking is primarily a service-vendor flow.

High-level booking flow:

```text
Customer selects service
        |
Customer selects date/time/address
        |
Commerce/vendor booking API creates booking
        |
Booking belongs to vendor
        |
Service vendor sees booking in dashboard/bookings page
        |
Vendor updates booking status
        |
Revenue and settlement flows use booking amount
```

Booking status values seen in the project include:

```text
pending
approved
in_progress
completed
rejected
cancelled
```

Service booking dashboard uses booking records to calculate:

- Total revenue
- Active bookings
- Listed services
- Recent bookings
- Weekly revenue chart

## 16. Order Flow

Orders are product-vendor flow.

High-level order flow:

```text
Customer adds products to cart
        |
Customer checks out
        |
Commerce service creates order
        |
Order belongs to vendor
        |
Product vendor sees order in product dashboard/orders page
        |
Vendor updates order status
        |
Settlement is generated/processed
```

Product vendor order routes include:

```http
GET   /api/v1/vendor/orders
GET   /api/v1/vendor/orders/:orderId
PATCH /api/v1/vendor/orders/:orderId
```

Service vendors should not depend on product order totals for their profile revenue.

## 17. Payment And Settlement Flow

Payment service handles payment intents and webhooks.

Commerce and vendor/admin services participate in settlement-related flows.

High-level flow:

```text
Customer pays for product/service
        |
Payment service / commerce service confirms payment
        |
Order or booking gets amount/status data
        |
Settlement row is created or updated
        |
Admin processes payout
        |
Vendor sees settlement/payment history
```

Vendor settlement route examples:

```http
GET /api/v1/vendor/me/settlements
```

Admin settlement routes include:

```http
GET   /api/admin/Settlements/all/null
GET   /api/admin/Settlements/individual/:id
POST  /api/admin/Settlements
PATCH /api/admin/Settlements/individual/:id
POST  /api/admin/upload/Settlements/:id
```

## 18. Notification Flow

Notification service supports:

- Vendor/customer inbox
- Mark notification as read
- Device registration for push notifications

Routes include:

```http
GET  /api/v1/notifications/me
POST /api/v1/notifications/me/:id/read
POST /api/v1/notifications/devices/register
```

Expected vendor events include:

- New order
- New booking
- Settlement status update
- Product/service moderation update
- KYC status update

## 19. Profile Flow

Profile service handles customer profile-related features.

Vendor profile is mostly handled by vendor management service.

Vendor profile routes include:

```http
GET   /api/v1/vendor/me
PATCH /api/v1/vendor/me
POST  /api/v1/vendor/me/upload
GET   /api/v1/vendor/me/plan
```

Vendor profile data includes:

- Business name
- Owner name
- Email
- Phone
- Address JSON
- Services/categories JSON
- KYC status
- Membership status
- Banner/logo/thumbnail URLs
- Commission rate / plan data

## 20. Media And Upload Flow

Upload paths are routed through the gateway:

| URL Prefix | Owner Service | Purpose |
|---|---|---|
| `/uploads` | Admin service | Admin uploads and media library |
| `/vendor-uploads` | Vendor service | Vendor product/service/KYC uploads |
| `/socio-uploads` | Socio service | Social post/story media |

Production storage should live outside git:

```text
/opt/p4u/storage/admin-uploads
/opt/p4u/storage/vendor-uploads
/opt/p4u/storage/socio-uploads
/opt/p4u/backups
```

The deployment scripts create symlinks from service upload folders to these persistent storage directories.

## 21. Content And Social Flow

Content service manages public-facing content such as:

- Banners
- Popup banners
- Brands
- Featured products
- Classified products
- Posts
- Service highlights
- Website queries

Socio service handles social features such as posts/stories/media, depending on active frontend usage.

Gateway routes:

```http
/api/v1/content/*
/api/v1/social/*
/socio-uploads/*
```

## 22. Database Flow

Most backend services use TypeORM with MySQL.

Common database setup:

```text
Host: localhost
Port: 3306
Username: root
Password: root@123
Database: p4u_admin_db
```

Environment variables can override DB settings:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=root@123
DB_NAME=p4u_admin_db
```

Some services include schema repair or migration scripts for defensive startup or local fixes.

## 23. Local Development Flow

Typical local backend service run:

```powershell
cd service-folder
npm install
npm run dev
```

Typical local frontend run:

```powershell
cd p4u-new-vendor-web
npm install
npm run dev
```

Vendor web production build check:

```powershell
cd "C:\Users\Kumareson\OneDrive\briefcase\P4U-New\p4u-new-vendor-web"
npm run build
```

Vendor web production start:

```powershell
npm start
```

Vendor web usually runs on:

```text
http://localhost:3002
```

## 24. Production Deployment Flow

The VPS folder `/opt/p4u` is not itself a git repository. It contains four separate clones:

```text
/opt/p4u/backend
/opt/p4u/admin-web
/opt/p4u/user-web
/opt/p4u/vendor-web
```

Never run `git pull` directly from `/opt/p4u`.

### Backend-only deploy

```bash
cd /opt/p4u/backend && git pull origin main
cd /opt/p4u/backend/<changed-service>
npm ci
npm run build
pm2 restart <pm2-service-name>
pm2 restart gateway
```

Gateway should usually restart after changed backend services.

### Vendor web deploy

```bash
cd /opt/p4u/vendor-web
git pull origin main
npm ci
npm run build
pm2 restart vendor-web
```

### User web deploy

```bash
cd /opt/p4u/user-web
git pull origin main
npm ci
npm run build
pm2 restart user-web
```

### Admin web deploy

```bash
cd /opt/p4u/admin-web
git pull origin main
export VITE_API_GATEWAY_URL=https://api.planext4u.com
npm ci
npm run build
```

Admin web is static. Nginx serves `dist/`.

## 25. Production Verification Commands

Gateway health:

```bash
curl -s http://127.0.0.1:8080/health
curl -s https://api.planext4u.com/health
```

Catalog public smoke test:

```bash
curl -s "https://api.planext4u.com/api/v1/catalog/public/products?limit=1"
```

Keycloak check:

```bash
docker ps | grep keycloak
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8180/
```

PM2 logs:

```bash
pm2 logs auth --lines 80
pm2 logs gateway --lines 50
pm2 logs vendor --lines 50
```

## 26. Git Workflow Notes

The local folder may contain nested repositories. Use the correct repo before committing.

For vendor web:

```powershell
cd "C:\Users\Kumareson\OneDrive\briefcase\P4U-New\p4u-new-vendor-web"
git status
git add <files>
git commit -m "message"
git push origin main
```

For backend:

```powershell
cd "C:\Users\Kumareson\OneDrive\briefcase\P4U-New"
git status
git add <files>
git commit -m "message"
git push origin main
```

If a folder is ignored by the parent repo, commit inside that folder's own repository.

## 27. Known Pending Vendor Backend Work

From `docs/VENDOR_BACKEND_PENDING.md`, important pending or improvement areas include:

- Vendor media library APIs
- Dropshipping APIs
- Vendor rating summary
- Product sales stats
- Booking status improvements
- Booking detail endpoint
- Booking metadata enrichment
- Order line item enrichment
- Settlement metadata and filtering
- KYC document upload
- Per-document KYC status
- Vendor plan payment
- Notification event emission
- Food/restaurant vendor vertical

Suggested implementation order from the doc:

1. Order line enrichment
2. Booking completed/detail/metadata improvements
3. Settlement metadata and filters
4. Ratings and product sold stats
5. Vendor media library
6. KYC upload and status
7. Membership payment and notification events
8. Dropshipping and food verticals

## 28. Important Project Rules And Conventions

- Service vendors use bookings.
- Product vendors use orders.
- Gateway is the public API entry point.
- Services register with discovery.
- Uploaded media should use gateway-relative URLs, not `127.0.0.1` URLs.
- Production uploaded files must live outside git clones.
- PM2 restarts should target only changed services when possible.
- Gateway should be restarted after backend service deploys.
- Admin web is static and does not need PM2 restart.
- Vendor and user web are Next.js apps served by PM2.
- Backend services are TypeScript builds served from `dist/server.js`.

## 29. Recent Issue: Service Vendor Revenue

Problem:

The service vendor profile showed:

```text
Bookings: 0
Revenue: ₹0
```

But the service dashboard showed:

```text
Total Revenue: ₹500
Recent Booking: ₹500
```

Root cause:

The service profile page was still using product order logic internally. It fetched product orders through `vendorOrdersApi.list(...)`, so service vendors got `₹0` because they had bookings, not product orders.

Correct behavior:

- Product vendor profile should fetch product orders.
- Service vendor profile should fetch service bookings.
- Service vendor revenue should sum booking amounts.
- Service vendor profile should label the count as `Bookings`, not `Orders`.

Files involved:

```text
p4u-new-vendor-web/components/vendor/profile/VendorBusinessProfileView.tsx
p4u-new-vendor-web/app/dashboard/service/page.tsx
p4u-new-vendor-web/lib/api/vendorBookings.ts
p4u-new-vendor-web/lib/vendor/dashboardMetrics.ts
```

## 30. Quick Mental Model

Think of the project like this:

```text
Frontend apps
  Admin Web       -> admin operations
  User Web        -> customer shopping/booking experience
  Vendor Web      -> product vendor + service vendor dashboards

Gateway
  Single public API layer

Discovery
  Knows which backend services are alive

Backend services
  Auth            -> identity and tokens
  Admin           -> admin control plane
  Catalog         -> catalog reads
  Content         -> homepage/content
  Profile         -> customer profile
  Commerce        -> cart/orders/bookings/pricing
  Payment         -> payment lifecycle
  Notification    -> inbox/device notifications
  Vendor          -> vendor portal APIs
  Socio           -> social feed/media

Database and infra
  MySQL, Keycloak, Firebase, file storage, PM2, Nginx
```

This is the main end-to-end project flow.
