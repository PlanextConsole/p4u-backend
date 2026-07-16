import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Vendor } from '../entities/Vendor';
import { VendorPlan } from '../entities/VendorPlan';
import { Product } from '../entities/Product';
import { ProductCategory } from '../entities/ProductCategory';
import { RewardPointsLedger } from '../entities/RewardPointsLedger';
import {
  getPlatformVarNumber,
  PLATFORM_VAR_KEYS,
} from './platformVariable.reader';
import { resolveCommissionPercent, resolveMaxRedemptionPercent } from './commissionResolver';
import { getSpendablePointsBalance } from './rewardBalance';

export type CartLineForPricing = {
  productId: string;
  vendorId: string | null;
  quantity: number;
  unitPrice: string | number;
  metadata?: Record<string, unknown> | null;
};

export type PricedLine = {
  productId: string;
  vendorId: string | null;
  categoryId: string | null;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  commissionPercent: string;
  commissionAmount: string;
  source: 'product_override' | 'category_override' | 'vendor_override' | 'plan' | 'none';
};

export type VendorBreakdown = {
  vendorId: string | null;
  vendorName: string | null;
  subtotal: string;
  commissionTotal: string;
  netToVendor: string;
};

export type CartPricingBreakdown = {
  currency: 'INR';
  itemSubtotal: string;
  discount: string;
  pointsRedeemed: number;
  pointsRedeemedValue: string;
  platformFee: string;
  gstOnPlatformFee: string;
  gstOnPlatformFeePercent: string;
  deliveryFee: string;
  surgeCost: string;
  productTax: string;
  grandTotal: string;
  minCartValue: string;
  meetsMinCart: boolean;
  maxRedeemableValue: string;
  maxRedeemablePercent: string;
  walletBalanceBefore: number;
  lines: PricedLine[];
  vendors: VendorBreakdown[];
  warnings: string[];
};

const fmt = (n: number): string => {
  if (!Number.isFinite(n)) return '0.00';
  return (Math.round(n * 100) / 100).toFixed(2);
};

const num = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : 0;
};

export class PricingService {
  /**
   * Computes the full checkout breakdown for a cart. Pure read — does not mutate carts/wallets.
   * Used by both the /quote endpoint (preview) and createOrderFromCart (persist on confirm).
   */
  async priceCart(
    customerId: string,
    lines: CartLineForPricing[],
    opts: { redeemPoints?: number } = {},
  ): Promise<CartPricingBreakdown> {
    const warnings: string[] = [];

    if (!lines.length) {
      return {
        currency: 'INR',
        itemSubtotal: '0.00',
        discount: '0.00',
        pointsRedeemed: 0,
        pointsRedeemedValue: '0.00',
        platformFee: '0.00',
        gstOnPlatformFee: '0.00',
        gstOnPlatformFeePercent: '0',
        deliveryFee: '0.00',
        surgeCost: '0.00',
        productTax: '0.00',
        grandTotal: '0.00',
        minCartValue: '0.00',
        meetsMinCart: true,
        maxRedeemableValue: '0.00',
        maxRedeemablePercent: '0',
        walletBalanceBefore: 0,
        lines: [],
        vendors: [],
        warnings,
      };
    }

    const productIds = Array.from(new Set(lines.map((l) => l.productId).filter(Boolean)));
    const products = productIds.length
      ? await AppDataSource.getRepository(Product).find({ where: { id: In(productIds) } })
      : [];
    const productById = new Map(products.map((p) => [p.id, p]));

    const categoryIds = Array.from(new Set(products.map((p) => p.categoryId).filter((id): id is string => !!id)));
    const categories = categoryIds.length
      ? await AppDataSource.getRepository(ProductCategory).find({ where: { id: In(categoryIds) } })
      : [];
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    const vendorIds = Array.from(
      new Set(
        lines
          .map((l) => l.vendorId ?? productById.get(l.productId)?.vendorId ?? null)
          .filter((v): v is string => !!v),
      ),
    );
    const vendors = vendorIds.length
      ? await AppDataSource.getRepository(Vendor).find({ where: { id: In(vendorIds) } })
      : [];
    const vendorById = new Map(vendors.map((v) => [v.id, v]));

    const planIds = Array.from(new Set(vendors.map((v) => v.vendorPlanId).filter((id): id is string => !!id)));
    const plans = planIds.length
      ? await AppDataSource.getRepository(VendorPlan).find({ where: { id: In(planIds) } })
      : [];
    const planById = new Map(plans.map((p) => [p.id, p]));

    const pricedLines: PricedLine[] = [];
    const vendorAgg = new Map<string, { subtotal: number; commission: number; vendorName: string | null }>();
    let itemSubtotal = 0;
    let maxRedeemableValueN = 0;

    for (const line of lines) {
      const product = productById.get(line.productId) ?? null;
      const resolvedVendorId = line.vendorId ?? product?.vendorId ?? null;
      const vendor = resolvedVendorId ? vendorById.get(resolvedVendorId) ?? null : null;
      const plan = vendor?.vendorPlanId ? planById.get(vendor.vendorPlanId) ?? null : null;
      const category = product?.categoryId ? categoryById.get(product.categoryId) ?? null : null;

      const qty = Math.max(0, Math.floor(Number(line.quantity) || 0));
      const unitPriceN = num(line.unitPrice);
      const lineTotalN = unitPriceN * qty;
      itemSubtotal += lineTotalN;

      const categoryVendorOverride =
        category?.metadata && typeof category.metadata === 'object' && resolvedVendorId
          ? (((category.metadata as Record<string, unknown>).vendorOverrides ?? null) as Record<string, unknown> | null)?.[resolvedVendorId] ?? null
          : null;

      const commissionPct = resolveCommissionPercent({
        productCommissionOverridePercent: product?.commissionOverridePercent,
        categoryVendorOverridePercent: categoryVendorOverride as string | number | null,
        categoryCommissionOverridePercent: category?.commissionOverridePercent,
        vendorCommissionRate: vendor?.commissionRate,
        vendorPlanCommissionPercent: plan?.commissionPercent,
      });

      let source: PricedLine['source'] = 'none';
      if (product?.commissionOverridePercent != null) source = 'product_override';
      else if (categoryVendorOverride != null) source = 'category_override';
      else if (category?.commissionOverridePercent != null) source = 'category_override';
      else if (vendor?.commissionRate != null) source = 'vendor_override';
      else if (plan?.commissionPercent != null) source = 'plan';

      const commissionAmount = (lineTotalN * commissionPct) / 100;

      const productMetadata = product?.metadata && typeof product.metadata === 'object'
        ? product.metadata as Record<string, unknown>
        : {};
      const redemptionPct = resolveMaxRedemptionPercent({
        productMaxRedemptionPercent: productMetadata.maxUserRedemptionPercent as string | number | null,
        vendorMaxRedemptionPercent: vendor?.maxRedemptionPercent,
        vendorPlanMaxUserRedemptionPercent: plan?.maxUserRedemptionPercent,
      });
      const productPointCapValue = productMetadata.maxPointsRedeemable;
      const productPointCapRaw = productPointCapValue == null || productPointCapValue === ''
        ? NaN
        : Number(productPointCapValue);
      const percentCapValue = (lineTotalN * redemptionPct) / 100;
      const lineCapValue = Number.isFinite(productPointCapRaw) && productPointCapRaw >= 0
        ? Math.min(percentCapValue, productPointCapRaw)
        : percentCapValue;
      maxRedeemableValueN += Math.max(0, lineCapValue);

      pricedLines.push({
        productId: line.productId,
        vendorId: resolvedVendorId,
        categoryId: product?.categoryId ?? null,
        quantity: qty,
        unitPrice: fmt(unitPriceN),
        lineTotal: fmt(lineTotalN),
        commissionPercent: fmt(commissionPct),
        commissionAmount: fmt(commissionAmount),
        source,
      });

      const key = resolvedVendorId ?? '__none__';
      const cur = vendorAgg.get(key) ?? { subtotal: 0, commission: 0, vendorName: vendor?.businessName ?? null };
      cur.subtotal += lineTotalN;
      cur.commission += commissionAmount;
      vendorAgg.set(key, cur);
    }

    const vendorBreakdown: VendorBreakdown[] = [...vendorAgg.entries()].map(([k, v]) => ({
      vendorId: k === '__none__' ? null : k,
      vendorName: v.vendorName,
      subtotal: fmt(v.subtotal),
      commissionTotal: fmt(v.commission),
      netToVendor: fmt(v.subtotal - v.commission),
    }));

    // Product caps apply per line; each product falls back to its vendor and then its plan.
    const maxRedeemablePct = itemSubtotal > 0 ? (maxRedeemableValueN / itemSubtotal) * 100 : 0;

    const [
      platformFeeBase,
      gstPct,
      deliveryFeeBase,
      surgeCostBase,
      minCartValue,
    ] = await Promise.all([
      getPlatformVarNumber(PLATFORM_VAR_KEYS.PLATFORM_FEE),
      getPlatformVarNumber(PLATFORM_VAR_KEYS.GST_ON_PLATFORM_FEE_PERCENT),
      getPlatformVarNumber(PLATFORM_VAR_KEYS.DELIVERY_FEE),
      getPlatformVarNumber(PLATFORM_VAR_KEYS.SURGE_COST),
      getPlatformVarNumber(PLATFORM_VAR_KEYS.MIN_CART_VALUE),
    ]);

    const ledgerRepo = AppDataSource.getRepository(RewardPointsLedger);
    const walletBalance = await getSpendablePointsBalance(ledgerRepo, customerId);
    const requestedRedeem = Math.max(0, Math.floor(Number(opts.redeemPoints) || 0));
    let pointsRedeemed = Math.min(requestedRedeem, walletBalance, Math.floor(maxRedeemableValueN));
    if (pointsRedeemed < 0) pointsRedeemed = 0;
    const pointsRedeemedValue = pointsRedeemed; // 1 point = 1 INR
    if (requestedRedeem > pointsRedeemed && requestedRedeem > 0) {
      warnings.push(
        `Requested ${requestedRedeem} points; capped to ${pointsRedeemed} (balance=${walletBalance}, maxAllowed=${Math.floor(maxRedeemableValueN)}).`,
      );
    }

    const platformFee = platformFeeBase;
    const gstOnPlatformFee = (platformFee * gstPct) / 100;
    const deliveryFee = deliveryFeeBase;
    const surgeCost = surgeCostBase;
    const productTax = 0;
    const discount = 0;

    const grandTotal =
      itemSubtotal -
      discount -
      pointsRedeemedValue +
      platformFee +
      gstOnPlatformFee +
      deliveryFee +
      surgeCost +
      productTax;

    const meetsMinCart = itemSubtotal >= minCartValue;
    if (!meetsMinCart) {
      warnings.push(`Cart subtotal ${fmt(itemSubtotal)} below minimum ${fmt(minCartValue)}.`);
    }

    return {
      currency: 'INR',
      itemSubtotal: fmt(itemSubtotal),
      discount: fmt(discount),
      pointsRedeemed,
      pointsRedeemedValue: fmt(pointsRedeemedValue),
      platformFee: fmt(platformFee),
      gstOnPlatformFee: fmt(gstOnPlatformFee),
      gstOnPlatformFeePercent: String(gstPct),
      deliveryFee: fmt(deliveryFee),
      surgeCost: fmt(surgeCost),
      productTax: fmt(productTax),
      grandTotal: fmt(Math.max(0, grandTotal)),
      minCartValue: fmt(minCartValue),
      meetsMinCart,
      maxRedeemableValue: fmt(maxRedeemableValueN),
      maxRedeemablePercent: String(maxRedeemablePct),
      walletBalanceBefore: walletBalance,
      lines: pricedLines,
      vendors: vendorBreakdown,
      warnings,
    };
  }
}
