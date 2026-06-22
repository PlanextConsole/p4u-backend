# Admin API modules

Add one folder per domain under `src/modules/<name>/`:

- `entities/` — TypeORM models (optional if entity lives in shared catalog DB later)
- `dto/` — `class-validator` DTOs
- `*.service.ts` — business logic
- `*.routes.ts` — `createXxxAdminRoutes()` mounted from `modules/admin-core/admin-core.routes.ts`

## Status

| Section | Module folder        | Status |
|--------|----------------------|--------|
| 3 Vendors & onboarding | `vendors/`     | Implemented (canonical + legacy aliases; cascade stubs) |
| 4 Customers, coupons, occupations | `customers/` | Implemented |
| 5 Categories & services | `catalog/` | Implemented (product batch stub) |
| 6 Products | `products/` | Implemented (review + tax batch stubs) |
| 7 Orders & settlements | `orders/` | Implemented |
| 8 Organization / referral orders | `organization-orders/` | Implemented |
| 9 Platform config & content ops | `platform-config/` | Implemented |
| 10 Tax | `products/` | Implemented (tax list/create/update/delete + batch relink paths) |
| 11 Banners & popup banners | `banners/` | Implemented |
| 12 Posts / feed / moderation | `posts/` | Implemented (comment batch stub) |
| 13 Vendor reviews | `vendor-reviews/` | Implemented |
| 14 Classified module | `classified/` | Implemented |
| 15 POS submodule | `pos/` | Implemented |
| 16 Dashboard / analytics | `analytics/` | Implemented |

Base URL: `/api/admin` (via gateway: same path).
