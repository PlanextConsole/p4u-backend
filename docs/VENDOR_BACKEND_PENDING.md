# Vendor backend — pending API work

**Scope:** `p4u-backend` microservices only (what the **vendor portal UI** needs).  
**Out of scope:** Customer web (`p4u-new-user-web`), frontend `lib/api` wiring, Supabase/Planext4u.  
**Gateway base:** `http://localhost:8080` (or deployed gateway URL).

**Reference UI:** `p4u-new-vendor-web` (product + service dashboards, auth, money/compliance).  
**Last reviewed:** 2026-06-22

---

## Summary

| Category | Count | Meaning |
|----------|------:|---------|
| **P0 — New modules** | 2 | No vendor API exists today |
| **P1 — Extend existing** | 14 | Route exists partially or data shape incomplete |
| **P2 — Exists, UI not built yet** | 5 | Backend ready; vendor UI may come later |
| **P3 — New verticals** | 2 | Food/restaurant, full dropshipping |
| **Pipeline / data quality** | 4 | Checkout/admin flows must populate fields UI reads |

---

## Services map (where work lands)

| Service | Role in vendor portal |
|---------|------------------------|
| `auth-management-services` | Phone OTP exchange, vendor register-by-phone, onboarding, change-password |
| `vendor-management-services` | Profile, products, orders, settlements, plan, services, availability, upload |
| `commerce-management-services` | Bookings (vendor list + status) |
| `notification-management-services` | In-app notifications + device tokens |
| `admin-management-services` | Media library tables (today admin-only), settlement payout processing, KYC review |

---

## Already implemented (vendor portal)

Use this as the baseline — **do not re-build** unless enriching.

### Auth (`/api/auth`)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/public/phone/exchange` | Firebase OTP → Keycloak tokens or registration token |
| POST | `/public/vendor/register-by-phone` | Full vendor signup wizard |
| POST | `/public/refresh` | Token refresh |
| POST | `/logout` | Revoke refresh token |
| GET | `/vendor/me/onboarding` | Pending signup request |
| POST | `/vendor/me/onboarding` | Submit/update onboarding |
| POST | `/change-password` | Keycloak password change (**exists; vendor UI not wired**) |

### Vendor (`/api/v1/vendor`) — `vendor-management-services`

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/me` | Vendor profile |
| PATCH | `/me` | Profile patch (`bankJson`, `documentsJson`, `addressJson`, `bannerUrl`, `thumbnailUrl`, email, phone, …) |
| POST | `/me/upload` | Image upload (products, service icons) — **images only, 8 MB** |
| GET | `/me/plan` | Plan tier + effective commission |
| GET | `/orders` | List vendor orders |
| GET | `/orders/:orderId` | Order detail |
| PATCH | `/orders/:orderId` | Update order status / metadata |
| GET | `/me/products` | List products (`q`, `moderation`, paging) |
| GET | `/me/products/:productId` | Product detail |
| POST | `/me/products` | Create product |
| PATCH | `/me/products/:productId` | Update product |
| DELETE | `/me/products/:productId` | Delete product |
| GET | `/me/catalog/categories-for-products` | Category tree |
| GET | `/me/catalog/tax-configurations` | Tax slabs |
| GET | `/me/catalog/product-attributes` | Attribute definitions |
| GET | `/me/catalog/service-categories` | Service categories |
| GET | `/me/catalog/service-items` | Catalog service templates |
| GET | `/me/vendor-services` | Vendor service offerings |
| POST | `/me/vendor-services` | Link catalog service + price |
| PATCH | `/me/vendor-services/:linkId` | Update offering |
| DELETE | `/me/vendor-services/:linkId` | Remove offering |
| GET | `/me/booking-availability` | Weekly schedule + date-offs |
| PUT | `/me/booking-availability` | Save availability |
| GET | `/me/settlements` | Settlement payout list (paging) |
| GET | `/reviews/by-order/:orderId` | Reviews for one order |
| GET | `/integrations/push-notification` | Hint only (not a real inbox) |
| GET/PATCH | `/organization-orders` … | Org orders (**no vendor UI**) |
| GET | `/referrals/...` | Referral stats (**no vendor UI**) |
| PATCH | `/me/products/:productId/override` | Commission override |
| PATCH | `/me/categories/:categoryId/override` | Category commission override |

### Commerce (`/api/v1/commerce`) — `commerce-management-services`

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/bookings/vendor` | Vendor booking list (`status`, paging) |
| PATCH | `/bookings/:bookingId/status` | Vendor/admin: **`approved` \| `rejected` only** |

### Notifications (`/api/v1/notifications`) — `notification-management-services`

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/me` | User notification inbox |
| POST | `/me/:id/read` | Mark read |
| POST | `/devices/register` | FCM/web push token |

---

## P0 — New backend modules (no vendor API today)

### 1. Vendor media library

**UI:** `/dashboard/product/media`, `/dashboard/service/media`  
**Today:** UI stores files in browser memory only. Admin has `media_library_folders` / `media_library_assets` under **admin-management-services** (admin routes only).

**Backend to build (vendor-scoped):**

```
GET    /api/v1/vendor/me/media/folders
POST   /api/v1/vendor/me/media/folders
GET    /api/v1/vendor/me/media/folders/:folderId/assets
POST   /api/v1/vendor/me/media/folders/:folderId/upload      (multipart)
DELETE /api/v1/vendor/me/media/assets/:assetId
GET    /api/v1/vendor/me/media/assets?q=&type=images|documents  (optional flat search)
```

**Notes:**

- Scope assets by `vendor_id` (new column or vendor-owned folders).
- Reuse storage pattern from admin media library (local disk / B2).
- Support images + PDF/documents (product listings, KYC-adjacent reuse possible).

**Suggested owner:** `vendor-management-services` (or shared media service proxied by gateway).

---

### 2. Dropshipping

**UI:** `/dashboard/product/dropshipping` (stub). Planext4u used Supabase tables; **nothing in p4u-backend**.

**Backend to build (new domain):**

```
GET    /api/v1/vendor/me/dropshipping/settings
PUT    /api/v1/vendor/me/dropshipping/settings
GET    /api/v1/vendor/me/dropshipping/suppliers          (platform catalog)
GET    /api/v1/vendor/me/dropshipping/orders
POST   /api/v1/vendor/me/dropshipping/orders/:id/forward  (or sync to supplier)
PATCH  /api/v1/vendor/me/dropshipping/orders/:id/status
```

**Data model (indicative):**

- `vendor_dropshipping_settings` (enabled, default_supplier_id, margin_percent, auto_forward, …)
- `dropshipping_suppliers` (platform-managed)
- `dropshipping_orders` (link to `commerce_orders` + supplier status)

**Suggested owner:** new tables + `vendor-management-services` or `commerce-management-services`.

---

## P1 — Extend existing APIs (UI blocked or degraded)

### 3. Vendor rating summary

**UI:** Product + service dashboards show **“Store rating —”** (hardcoded unavailable).

**Gap:** Only per-order reviews exist:

```
GET /api/v1/vendor/reviews/by-order/:orderId
```

**Add:**

```
GET /api/v1/vendor/me/rating-summary
→ { averageRating, reviewCount, lastReviewAt? }

GET /api/v1/vendor/me/reviews?limit=&offset=   (optional list for future page)
```

**Source table:** `vendor_reviews` (already mirrored in vendor-management-services).

---

### 4. Product sales stats (“units sold”)

**UI:** Products list shows **“0 sold”** (placeholder).

**Add (pick one):**

- Extend `GET /api/v1/vendor/me/products` items with `unitsSold`, `revenue`, or
- `GET /api/v1/vendor/me/products/:productId/stats`

**Source:** Aggregate from `commerce_orders` metadata lines or order-line table by `productId` + `vendorId`.

---

### 5. Booking — mark completed (and in-progress)

**UI:** Bookings page stats include **Completed**; vendor can only **Approve / Reject**.

**Today:**

```
PATCH /api/v1/commerce/bookings/:bookingId/status
Body: { status: "approved" | "rejected" }
```

**Extend vendor path to allow:**

```
{ status: "approved" | "rejected" | "completed" | "in_progress" | "cancelled" }
```

(with valid transitions enforced in `BookingService`).

**File:** `commerce-management-services/src/service/booking.service.ts`

---

### 6. Booking — vendor detail

**UI:** Bookings are list-only (no detail modal).

**Add:**

```
GET /api/v1/commerce/bookings/vendor/:bookingId
```

Vendor-scoped; return customer snapshot, service name, notes, address, amounts, metadata.

---

### 7. Booking list — enrich metadata

**UI:** Customer name column uses `metadata.customerName` (fallback to truncated `customerId`).

**Ensure at booking create:**

- `metadata.customerName`, `customerPhone`, `serviceName`, `totalAmount`

**File:** `commerce-management-services` booking create flow.

---

### 8. Order detail — enrich line items for vendor UI

**UI:** `OrderDetailModal` reads `metadata.items` or `metadata.lines` with `name`, `thumbnailUrl`, `quantity`.

**Today:** Checkout stores `metadata.lines` from cart without guaranteed product name/thumb.

**Fix (one of):**

- Enrich in `cart.service.ts` `createOrderFromCart` (join catalog products), or
- Enrich in `vendor-management-services` `getOrderForVendor` on read

**Also:** Set `metadata.displayId` (UI prefers over raw UUID) — today only `orderRef` (`ORD-{timestamp}`) is set.

---

### 9. Settlements — richer metadata on payout

**UI:** Settlements + payment history show `displayRef`, `txn`, `settledAt`, gross, commission.

**Today (checkout creates settlement):**

```json
metadata: {
  "orderRef": "...",
  "vendorSubtotal": "...",
  "commissionTotal": "...",
  "vendorName": "..."
}
```

**When admin marks settled, also persist:**

- `metadata.settledAt` / `settled_at`
- `metadata.transactionRef` / `bankTxnId`
- `metadata.displayRef` / `settlementCode`

**Optional:**

```
GET /api/v1/vendor/me/settlements/:settlementId
```

---

### 10. Settlements — server-side filters

**UI:** Payment history filters by search + date **client-side** (loads max 100 rows).

**Extend:**

```
GET /api/v1/vendor/me/settlements?q=&from=&to=&status=&limit=&offset=
```

---

### 11. KYC — document file upload

**UI:** KYC page accepts **HTTPS URL** only (Google Drive links).

**Today:** `POST /api/v1/vendor/me/upload` — **images only**.

**Add:**

```
POST /api/v1/vendor/me/documents/upload   (multipart: pdf, jpg, png)
→ { url, kind: "aadhaar"|"pan"|"gst" }
```

Or extend `/me/upload` to allow `application/pdf` with separate size limit.

**Storage:** Same as vendor uploads or private bucket with signed read URLs.

---

### 12. KYC — per-document verification status

**UI:** Shows **Submitted / Not submitted** only.

**Expose on `GET /api/v1/vendor/me` (or nested `documentsJson`):**

```json
{
  "aadhaar": { "url": "...", "status": "pending|verified|rejected", "reviewedAt": "..." },
  "pan": { ... },
  "gst": { ... }
}
```

**Owner:** Admin KYC review workflow must write status back to vendor row / `documentsJson`.

---

### 13. Profile — banner / logo upload path

**API mostly exists:** `PATCH /api/v1/vendor/me` with `bannerUrl`, `thumbnailUrl` + `POST /me/upload`.

**Backend note:** Ensure uploaded URLs are returned in a form the gateway serves (`/vendor-uploads/...` or CDN). No new route strictly required unless UI demands multipart profile endpoint:

```
PATCH /api/v1/vendor/me/avatar   (optional convenience)
PATCH /api/v1/vendor/me/banner
```

---

### 14. Membership / plan payment

**UI:** Profile shows **Paid / unpaid** from `membershipStatus`; no payment flow.

**Add:**

```
POST /api/v1/vendor/me/plan/checkout     → { gatewayOrderId, amount, ... }
POST /api/v1/vendor/me/plan/confirm      → webhook or client callback
```

**On success:** set `catalog_vendors.membership_status`, optionally `vendor_plan_id`.

**Integrate with:** existing payment gateway used for customer checkout (commerce-service).

---

### 15. Notifications — vendor event emission

**Inbox API exists** (`GET /api/v1/notifications/me`) but **vendor UI not wired**.

**Backend follow-up:** Ensure these events create `user_notifications` rows for vendor Keycloak `sub`:

- New order / booking
- Settlement settled / rejected
- Product/service moderation approved/rejected
- KYC document rejected

**Owner:** Each producing service or a small notification dispatcher.

---

### 16. Change password

**Route exists:** `POST /api/auth/change-password` (auth-management-services).

**Backend:** Verify vendor role permissions in Keycloak; document request body in vendor API doc. **No new route needed** unless vendor-specific validation is required.

---

## P2 — Backend exists; vendor UI not built (low priority for backend)

| # | Routes | Notes |
|---|--------|-------|
| 17 | `GET/POST/PATCH /api/v1/vendor/organization-orders` | B2B org orders |
| 18 | `GET /api/v1/vendor/referrals/code-usage/:code` | Referral analytics |
| 19 | `GET /api/v1/vendor/referrals/my-organization-orders/:code` | Referral orders |
| 20 | `GET /api/v1/vendor/reviews/by-order/:orderId` | Wire into order detail when UI ready |
| 21 | `PATCH /api/v1/vendor/me/products/:id/override` | Product form may use product PATCH instead |

---

## P3 — New verticals (no vendor backend)

| Vertical | Planext4u reference | Backend status |
|----------|---------------------|----------------|
| **Food / restaurant vendor** | `VendorRestaurantPage`, `VendorFoodOrdersPage` | Not in p4u-backend |
| **Full dropshipping** | `VendorDropshippingPage` | See P0 #2 |

**Food/restaurant would need (indicative):**

- Menu categories / items CRUD
- Restaurant profile (hours, cuisine, delivery radius)
- Food order queue (separate from product `commerce_orders` or type discriminator)
- Kitchen status workflow

---

## Pipeline / data quality (not new routes, but required for UI)

| # | Issue | UI impact | Fix location |
|---|-------|-----------|--------------|
| 22 | Orders created without `metadata.lines` | “No line items” in order modal | Customer must checkout via `createOrderFromCart` |
| 23 | Settlements only after checkout + admin payout | Empty settlements/payments pages | Admin settlement processing + commerce checkout |
| 24 | Booking `totalAmount` missing | Service dashboard revenue undercounts | Set on booking create / payment |
| 25 | `membershipStatus` never set to `paid` | Profile always shows unpaid | Plan payment flow (P1 #14) or admin manual set |

---

## Suggested implementation order

1. **P1 #8** — Order line enrichment (unblocks order ops immediately)  
2. **P1 #5–7** — Booking completed + detail + metadata  
3. **P1 #9–10** — Settlement metadata + filters  
4. **P1 #3–4** — Ratings + product sold stats  
5. **P0 #1** — Vendor media library  
6. **P1 #11–12** — KYC upload + status  
7. **P1 #14–15** — Membership payment + notification events  
8. **P0 #2 / P3** — Dropshipping, food vertical  

---

## Permission / Keycloak checklist

Ensure vendor realm roles include (already referenced in middleware):

- `vendor.portal.me.read` / `vendor.portal.me.write`
- `vendor.portal.order.read` / `vendor.portal.order.write`
- `vendor.portal.service.read` / `vendor.portal.service.write`
- `vendor.portal.settlement.read`
- `booking.read.self` / `booking.write.self`
- `notification.read.self` / `notification.device.register`

New routes should reuse these patterns or add narrowly scoped permissions.

---

## Related docs

- Vendor web API clients: `p4u-new-vendor-web/lib/api/*`
- Admin media library: `admin-management-services/src/modules/media-library/`
- Vendor routes: `vendor-management-services/src/routes/vendor.routes.ts`
- Commerce bookings: `commerce-management-services/src/routes/commerce.routes.ts`
