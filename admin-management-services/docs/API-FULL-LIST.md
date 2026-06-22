# Admin Management Service — full API list

**Base URL (direct service):** `{host}:{port}` (default port `8082`, `SERVER_PORT`).

**Admin API prefix:** `/api/admin`  
**Full path pattern:** `{base}/api/admin{path below}`

**Auth**

| Type | Header / note |
|------|----------------|
| **Public** | No `Authorization` (only routes marked *Public* below). |
| **Admin JWT** | `Authorization: Bearer <access_token>` + Keycloak **realm role `ADMIN`** (all other `/api/admin/*` routes). |

**Common query params**

- **`limit`**, **`offset`** — pagination where lists support it (defaults vary; caps often 100).
- **`purpose=all`** or **`includeInactive=true`** — include inactive rows on some list endpoints.

**Request bodies** — `Content-Type: application/json` unless noted. Shapes match `class-validator` DTOs under `src/modules/**/dto/` and `src/modules/admin-core/dto/`.

---

## App root (not under `/api/admin`)

| Method | Path | Auth | Query | Body |
|--------|------|------|-------|------|
| GET | `/` | No | — | — |

---

## Public (`/api/admin`)

| Method | Path | Auth | Query | Body |
|--------|------|------|-------|------|
| GET | `/api/admin/public/health` | No | — | — |
| GET | `/api/admin/public/layouts/screen/:screenKey` | No | — | — |

---

## Admin core (secured)

| Method | Path | Query | Body |
|--------|------|-------|------|
| GET | `/api/admin/me` | — | — |
| GET | `/api/admin/hierarchy/nodes` | `includeInactive=true` optional | — |
| GET | `/api/admin/hierarchy/nodes/:id` | — | — |
| POST | `/api/admin/hierarchy/nodes` | — | `CreateHierarchyNodeDto`: `name`, `nodeType`, optional `parentId`, `responsibleUserId`, `geoZone` |
| PATCH | `/api/admin/hierarchy/nodes/:id` | — | `UpdateHierarchyNodeDto`: optional fields + `isActive` |
| GET | `/api/admin/layouts` | `screenKey` optional | — |
| GET | `/api/admin/layouts/published/screen/:screenKey` | — | — |
| GET | `/api/admin/layouts/:id` | — | — |
| POST | `/api/admin/layouts` | — | `CreateAppLayoutDto`: `screenKey`, `displayName`, `widgetConfig`, optional `targetingRules`, `priority`, `validFrom`, `validTo` |
| PATCH | `/api/admin/layouts/:id` | — | `UpdateAppLayoutDto` (partial) |
| POST | `/api/admin/layouts/:id/publish` | — | — |
| POST | `/api/admin/layouts/:id/unpublish` | — | — |
| GET | `/api/admin/audit-logs` | `page`, `limit`, `entityType`, `actorSub` | — |

---

## Vendors (secured)

| Method | Path | Query | Body |
|--------|------|-------|------|
| GET | `/api/admin/vendors` | `limit`, `offset` | — |
| POST | `/api/admin/vendors` | — | `CreateVendorDto` |
| GET | `/api/admin/vendors/:id` | — | — |
| PATCH | `/api/admin/vendors/:id` | — | `UpdateVendorDto` |
| DELETE | `/api/admin/vendors/:id` | — | — |
| POST | `/api/admin/add_vendors` | — | *alias* → same as `POST /vendors` |
| GET | `/api/admin/vendor/:id` | — | *alias* → `GET /vendors/:id` |
| PATCH | `/api/admin/vendor/:id` | — | *alias* |
| DELETE | `/api/admin/vendor/:id` | — | *alias* |
| GET | `/api/admin/vendor-requests` | `limit`, `offset` | — |
| DELETE | `/api/admin/vendor-requests/:id` | — | — |
| GET | `/api/admin/vendors_request` | `limit`, `offset` | *alias* |
| DELETE | `/api/admin/vendors_request/:id` | — | *alias* |
| GET | `/api/admin/vendor-enquiries` | `limit`, `offset` | — |
| GET | `/api/admin/vendor-enquiries/:id` | — | — |
| PATCH | `/api/admin/vendor-enquiries/:id` | — | `UpdateVendorEnquiryDto` |
| GET | `/api/admin/vendorEnquiry` | `limit`, `offset` | *alias* |
| GET | `/api/admin/vendorEnquiry/:id` | — | *alias* |
| PATCH | `/api/admin/vendorEnquiry/:id` | — | *alias* |
| PATCH | `/api/admin/products/batchVendor/:vendorId` | — | — (stub) |
| PATCH | `/api/admin/orders/batchVendors/:vendorId` | — | — (stub) |
| PATCH | `/api/admin/Settlements/batch/:vendorId` | — | — (stub) |
| PATCH | `/api/admin/settlements/batch/:vendorId` | — | — (stub) |
| PATCH | `/api/admin/products_Request/batch/:vendorId` | — | — (stub) |
| PATCH | `/api/admin/products_request/batch/:vendorId` | — | — (stub) |
| PATCH | `/api/admin/coupons/batch/:vendorId` | — | — (stub) |
| PATCH | `/api/admin/vendorReviews/batchVendors/:vendorId` | — | — (stub) |
| PATCH | `/api/admin/organizationOrders/batchVendors/:vendorId` | — | — (stub) |
| DELETE | `/api/admin/serviceNotifications/vendors/:vendorId` | — | — |
| GET | `/api/admin/orders/vendors/:vendorId` | `limit`, `offset` | — (stub empty list) |

---

## Customers (secured)

| Method | Path | Query | Body |
|--------|------|-------|------|
| GET | `/api/admin/customers` | `limit`, `offset` | — |
| PATCH | `/api/admin/customers/:id` | — | `UpdateCustomerDto` |
| DELETE | `/api/admin/customers/:id` | — | — |
| GET | `/api/admin/coupons/all/null` | `limit`, `offset` | — |
| GET | `/api/admin/coupons` | `limit`, `offset` | *alias* |
| GET | `/api/admin/Occupations` | `purpose=all` or `includeInactive=true` | — |
| GET | `/api/admin/occupations` | same | *alias* |
| POST | `/api/admin/occupations` | — | `CreateOccupationDto` |
| POST | `/api/admin/Occupations` | — | *alias* |
| PATCH | `/api/admin/occupations/individual/:id` | — | `UpdateOccupationDto` |
| PATCH | `/api/admin/Occupations/individual/:id` | — | *alias* |
| PATCH | `/api/admin/occupations/:id` | — | *alias* |

---

## Catalog (secured)

| Method | Path | Query | Body |
|--------|------|-------|------|
| GET | `/api/admin/categories/all` | `purpose=all` or `includeInactive=true` | — |
| GET | `/api/admin/categories` | same | — |
| POST | `/api/admin/add_categories` | — | `CreateCategoryDto` |
| POST | `/api/admin/categories` | — | *alias* |
| PATCH | `/api/admin/categories/:id` | — | `UpdateCategoryDto` |
| PATCH | `/api/admin/category/:id` | — | *alias* |
| GET | `/api/admin/services/all` | `purpose=all` or `includeInactive=true` | — |
| GET | `/api/admin/services` | same | — |
| POST | `/api/admin/add_services` | — | `CreateCatalogServiceDto` |
| POST | `/api/admin/services` | — | *alias* |
| PATCH | `/api/admin/services/batch/:categoryId` | — | — |
| PATCH | `/api/admin/services/individual/:id` | — | `UpdateCatalogServiceDto` |
| PATCH | `/api/admin/services/:id` | — | *alias* |
| DELETE | `/api/admin/service/:id` | — | — |
| DELETE | `/api/admin/services/:id` | — | *alias* |
| PATCH | `/api/admin/products/batchCategory/:categoryId` | — | — (stub) |

---

## Products & tax (secured)

| Method | Path | Query | Body |
|--------|------|-------|------|
| GET | `/api/admin/Products/all/null` | `limit`, `offset` | — |
| GET | `/api/admin/products` | `limit`, `offset` | — |
| POST | `/api/admin/add_products` | — | `CreateProductDto` |
| POST | `/api/admin/products` | — | *alias* |
| PATCH | `/api/admin/products/individual/:id` | — | `UpdateProductDto` |
| PATCH | `/api/admin/Products/individual/:id` | — | *alias* |
| PATCH | `/api/admin/products/:id` | — | *alias* |
| DELETE | `/api/admin/product/:id` | — | — |
| DELETE | `/api/admin/products/:id` | — | *alias* |
| GET | `/api/admin/taxconfiguration` | `purpose=all` or `includeInactive=true` | — |
| GET | `/api/admin/taxConfiguration` | same | *alias* |
| POST | `/api/admin/taxconfiguration` | — | `CreateTaxConfigurationDto` |
| POST | `/api/admin/taxConfiguration` | — | *alias* |
| PATCH | `/api/admin/taxconfiguration/:id` | — | `UpdateTaxConfigurationDto` |
| PATCH | `/api/admin/taxConfiguration/:id` | — | *alias* |
| DELETE | `/api/admin/taxConfiguration/:id` | — | — |
| DELETE | `/api/admin/taxconfiguration/:id` | — | *alias* |
| PATCH | `/api/admin/product_reviews/batchProducts/:productId` | — | — (stub) |
| GET | `/api/admin/products_request` | `limit`, `offset` | — |
| PATCH | `/api/admin/products_request/individual/:id` | — | `UpdateProductRequestDto` |
| PATCH | `/api/admin/Products/batchTaxConfiguration/:id` | — | — |
| PATCH | `/api/admin/products_request/batchTaxConfiguration/:id` | — | — |

---

## Orders & settlements (secured)

| Method | Path | Query | Body |
|--------|------|-------|------|
| GET | `/api/admin/orders/all/null` | `limit`, `offset` | — |
| GET | `/api/admin/orders` | `limit`, `offset` | — |
| GET | `/api/admin/orders/individual/:id` | — | — |
| GET | `/api/admin/orders/individualOrder/:id` | — | — |
| PATCH | `/api/admin/orders/individual/:id` | — | `UpdateOrderDto` |
| POST | `/api/admin/orders` | — | `CreateOrderDto` |
| GET | `/api/admin/orders/vendors/:vendorId` | `limit`, `offset` | — |
| GET | `/api/admin/Settlements/all/null` | `limit`, `offset` | — |
| GET | `/api/admin/Settlements/allCash/null` | `limit`, `offset` | — |
| GET | `/api/admin/Settlements/allPoints/null` | `limit`, `offset` | — |
| GET | `/api/admin/settlements/all/null` | `limit`, `offset` | *alias* |
| GET | `/api/admin/Settlements/individual/:id` | — | — |
| GET | `/api/admin/Settlements/individualByVendorSingle/:id` | — | — |
| POST | `/api/admin/Settlements` | — | `CreateSettlementDto` |
| POST | `/api/admin/settlements` | — | *alias* |
| PATCH | `/api/admin/Settlements/individual/:id` | — | `UpdateSettlementDto` |
| POST | `/api/admin/upload/Settlements/:id` | — | `{ "fileUrl": "https://..." }` |

---

## Organization orders (secured)

| Method | Path | Query | Body |
|--------|------|-------|------|
| GET | `/api/admin/organizationOrders/all/null` | `limit`, `offset` | — |
| GET | `/api/admin/organizationOrders/allVendors/null` | `limit`, `offset` | — |
| POST | `/api/admin/organizationOrders` | — | `CreateOrganizationOrderDto` |
| PATCH | `/api/admin/organizationOrders/individual/:id` | — | `UpdateOrganizationOrderDto` |
| PATCH | `/api/admin/organizationOrders/individualVendorAllUnclaimed/:vendorId` | — | — |
| GET | `/api/admin/organizationOrders/topReferrals/null` | `limit`, `offset` | — |

---

## Platform config (secured)

| Method | Path | Query | Body |
|--------|------|-------|------|
| GET | `/api/admin/platformVariables` | `limit`, `offset` | — |
| POST | `/api/admin/platformVariables` | — | `CreatePlatformVariableDto` |
| PATCH | `/api/admin/platformVariables/:id` | — | `UpdatePlatformVariableDto` |
| DELETE | `/api/admin/platformVariables/:id` | — | — |
| GET | `/api/admin/websiteQueries` | `limit`, `offset` | — |
| PATCH | `/api/admin/websiteQueries/:id` | — | `UpdateWebsiteQueryDto` |

---

## Banners (secured)

| Method | Path | Query | Body |
|--------|------|-------|------|
| GET | `/api/admin/allBanners` | — | — |
| POST | `/api/admin/add_banner` | — | `CreateBannerDto` |
| POST | `/api/admin/banners` | — | *alias* |
| PATCH | `/api/admin/Banners/:id` | — | `UpdateBannerDto` |
| PATCH | `/api/admin/banners/:id` | — | *alias* |
| GET | `/api/admin/popupBanner` | — | — |
| POST | `/api/admin/addPopupBanner` | — | `CreateBannerDto` |
| PATCH | `/api/admin/popupBanner/:id` | — | `UpdateBannerDto` |

---

## Posts / feed (secured)

| Method | Path | Query | Body |
|--------|------|-------|------|
| GET | `/api/admin/advertisementFeed` | `limit`, `offset` | — |
| POST | `/api/admin/add_posts` | — | `CreatePostDto` |
| PATCH | `/api/admin/posts/individual/:id` | — | `UpdatePostDto` |
| PATCH | `/api/admin/posts/:id` | — | *alias* |
| GET | `/api/admin/objectionableFeedLog` | `limit`, `offset`, `purpose` | — |
| PATCH | `/api/admin/objectionableFeedLog/batchFeed/:id` | — | `UpdateObjectionableLogDto` |
| PATCH | `/api/admin/comments/batchCustomersFor/:id` | — | — (stub) |
| DELETE | `/api/admin/posts/:id` | — | — |

---

## Vendor reviews (secured)

| Method | Path | Query | Body |
|--------|------|-------|------|
| GET | `/api/admin/vendorReviews/all/null` | `limit`, `offset` | — |
| GET | `/api/admin/vendorReviews` | `limit`, `offset` | — |
| POST | `/api/admin/vendorReviews` | — | `CreateVendorReviewDto` |
| DELETE | `/api/admin/vendorReviews/:id` | — | — |

---

## Classified (secured)

| Method | Path | Query | Body |
|--------|------|-------|------|
| GET | `/api/admin/availableCities` | `limit`, `offset`, `purpose` | — |
| POST | `/api/admin/availableCities` | — | `UpsertNameActiveDto` |
| PATCH | `/api/admin/availableCities/:id` | — | `UpsertNameActiveDto` |
| PATCH | `/api/admin/availableCities/individual/:id` | — | *alias* |
| DELETE | `/api/admin/availableCities/:id` | — | — |
| GET | `/api/admin/availableAreas` | `limit`, `offset`, `purpose` | — |
| POST | `/api/admin/availableAreas` | — | `UpsertNameActiveDto` |
| PATCH | `/api/admin/availableAreas/individual/:id` | — | `UpsertNameActiveDto` |
| DELETE | `/api/admin/availableAreas/:id` | — | — |
| GET | `/api/admin/classifiedCategories` | `limit`, `offset`, `purpose` | — |
| POST | `/api/admin/classifiedCategories` | — | `UpsertNameActiveDto` |
| PATCH | `/api/admin/classifiedCategories/:id` | — | `UpsertNameActiveDto` |
| DELETE | `/api/admin/classifiedCategories/:id` | — | — |
| GET | `/api/admin/classifiedServices` | `limit`, `offset`, `purpose` | — |
| POST | `/api/admin/classifiedServices` | — | `UpsertNameActiveDto` |
| PATCH | `/api/admin/classifiedServices/individual/:id` | — | `UpsertNameActiveDto` |
| DELETE | `/api/admin/classifiedServices/:id` | — | — |
| GET | `/api/admin/classifiedVendors` | `limit`, `offset`, `purpose` | — |
| POST | `/api/admin/classifiedVendors` | — | `UpsertNameActiveDto` |
| PATCH | `/api/admin/classifiedVendors/individual/:id` | — | `UpsertNameActiveDto` |
| DELETE | `/api/admin/classifiedVendors/:id` | — | — |
| GET | `/api/admin/classifiedProducts` | `limit`, `offset`, `purpose` | — |
| POST | `/api/admin/classifiedProducts` | — | `UpsertClassifiedProductDto` |
| POST | `/api/admin/ClassifiedProducts` | — | *alias* |
| PATCH | `/api/admin/classifiedProducts/:id` | — | `UpsertClassifiedProductDto` |
| DELETE | `/api/admin/ClassifiedProducts/:id` | — | — |
| DELETE | `/api/admin/classifiedProducts/:id` | — | *alias* |
| POST | `/api/admin/upload/ClassifiedProducts/:id` | — | `{ "imageUrls": ["https://..."] }` |

---

## POS (secured)

| Method | Path | Query | Body |
|--------|------|-------|------|
| GET | `/api/admin/posVendors` | `limit`, `offset` | — |
| POST | `/api/admin/posVendors` | — | `UpsertPosVendorDto` |
| PATCH | `/api/admin/posVendors/individual/:id` | — | `UpsertPosVendorDto` |
| PATCH | `/api/admin/POSVendors/individual/:id` | — | *alias* |
| DELETE | `/api/admin/posVendors/:id` | — | — |
| GET | `/api/admin/posProducts` | `limit`, `offset` | — |
| POST | `/api/admin/posProducts` | — | `UpsertPosProductDto` |
| PATCH | `/api/admin/posProducts/individual/:id` | — | `UpsertPosProductDto` |
| PATCH | `/api/admin/POSProducts/individual/:id` | — | *alias* |
| DELETE | `/api/admin/posProducts/:id` | — | — |
| GET | `/api/admin/posCategories` | `limit`, `offset` | — |
| POST | `/api/admin/posCategories` | — | `UpsertPosCategoryDto` |
| PATCH | `/api/admin/POSCategories/:id` | — | `UpsertPosCategoryDto` |
| PATCH | `/api/admin/posCategories/:id` | — | *alias* |
| DELETE | `/api/admin/posCategories/:id` | — | — |

---

## Analytics (secured)

| Method | Path | Query | Body |
|--------|------|-------|------|
| GET | `/api/admin/metadata/all/null` | — | — |
| GET | `/api/admin/usersJoined/customers` | `dateFrom`, `dateTo` optional | — |
| GET | `/api/admin/usersJoined/vendors` | `dateFrom`, `dateTo` optional | — |

---

## Machine-readable / Postman

- **Curl lines:** `docs/admin-api-curl-reference.sh`
- **Postman collection (folders + requests):** `docs/P4U-Microservices.postman_collection.json` — see `docs/POSTMAN-IMPORT.md`

---

## DTO field details

Open the matching file under `src/modules/<module>/dto/` or `src/modules/admin-core/dto/` for exact properties and validation rules.
