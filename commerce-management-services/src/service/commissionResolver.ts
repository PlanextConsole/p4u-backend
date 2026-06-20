/**
 * Resolves the commission % to apply for a single order line.
 * Precedence (most-specific wins):
 *   product.commissionOverridePercent
 *   → category.metadata.vendorOverrides[vendorId]   (vendor-portal per-category override)
 *   → category.commissionOverridePercent             (admin-set global category override)
 *   → vendor.commissionRate
 *   → vendorPlan.commissionPercent
 *   → 0
 */
export type CommissionInputs = {
  productCommissionOverridePercent?: string | number | null;
  categoryVendorOverridePercent?: string | number | null;
  categoryCommissionOverridePercent?: string | number | null;
  vendorCommissionRate?: string | number | null;
  vendorPlanCommissionPercent?: string | number | null;
};

function pctNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function resolveCommissionPercent(inputs: CommissionInputs): number {
  const product = pctNumber(inputs.productCommissionOverridePercent);
  if (product != null) return product;
  const categoryVendor = pctNumber(inputs.categoryVendorOverridePercent);
  if (categoryVendor != null) return categoryVendor;
  const category = pctNumber(inputs.categoryCommissionOverridePercent);
  if (category != null) return category;
  const vendor = pctNumber(inputs.vendorCommissionRate);
  if (vendor != null) return vendor;
  const plan = pctNumber(inputs.vendorPlanCommissionPercent);
  if (plan != null) return plan;
  return 0;
}

/** Resolves the per-vendor max-redemption % (vendor override → plan default → 0). */
export function resolveMaxRedemptionPercent(inputs: {
  vendorMaxRedemptionPercent?: string | number | null;
  vendorPlanMaxUserRedemptionPercent?: string | number | null;
}): number {
  const v = pctNumber(inputs.vendorMaxRedemptionPercent);
  if (v != null) return v;
  const p = pctNumber(inputs.vendorPlanMaxUserRedemptionPercent);
  if (p != null) return p;
  return 0;
}
