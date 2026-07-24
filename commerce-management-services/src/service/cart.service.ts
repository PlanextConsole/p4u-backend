import { randomUUID } from 'crypto';
import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Cart } from '../entities/Cart';
import { CartItem } from '../entities/CartItem';
import { CustomerProfile } from '../entities/CustomerProfile';
import { Settlement } from '../entities/Settlement';
import { RewardPointsLedger } from '../entities/RewardPointsLedger';
import { CustomerReferralRewardService } from './customerReferralReward.service';
import { Order } from '../entities/Order';
import { Product } from '../entities/Product';
import { CommerceQueryService } from './commerceQuery.service';
import { PricingService, type CartPricingBreakdown } from './pricing.service';
import { CouponService } from './coupon.service';

export type CartLineInput = {
  productId: string;
  vendorId?: string | null;
  variationId?: string | null;
  quantity: number;
  unitPrice: string | number;
  metadata?: Record<string, unknown> | null;
};

function normalizeVariationId(v: string | null | undefined): string | null {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  return String(v).trim();
}

function cartLineKey(productId: string, vendorId: string | null, variationId: string | null): string {
  return `${productId}::${vendorId ?? ''}::${variationId ?? ''}`;
}

function normalizeVendorId(v: string | null | undefined): string | null {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  return String(v);
}

function clampQty(n: number): number {
  const q = Math.floor(Number(n));
  if (Number.isNaN(q) || q < 1) return 1;
  return Math.min(q, 999);
}

function formatPrice(v: string | number): string {
  const n = Number(v);
  if (Number.isNaN(n) || n < 0) return '0.00';
  return n.toFixed(2);
}

export class CartService {
  private customerReferralRewards = new CustomerReferralRewardService();
  private commerce = new CommerceQueryService();
  private pricing = new PricingService();

  /** Returns a full pre-checkout breakdown without persisting anything. */
  async quoteCart(
    customerId: string,
    opts: { redeemPoints?: number; couponCode?: string; vendorId?: string } = {},
  ): Promise<CartPricingBreakdown & { cartId: string }> {
    const data = await this.getCartResponse(customerId);
    const breakdown = await this.pricing.priceCart(
      customerId,
      data.items.map((i) => ({
        productId: i.productId,
        vendorId: i.vendorId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        metadata: i.metadata,
      })),
      opts,
    );
    return { ...breakdown, cartId: data.id };
  }

  private cartRepo() {
    return AppDataSource.getRepository(Cart);
  }

  private itemRepo() {
    return AppDataSource.getRepository(CartItem);
  }

  async getOrCreateCart(customerId: string): Promise<Cart> {
    let cart = await this.cartRepo().findOne({ where: { customerId } });
    if (!cart) {
      cart = this.cartRepo().create({ id: randomUUID(), customerId });
      cart = await this.cartRepo().save(cart);
    }
    return cart;
  }

  async getCartResponse(customerId: string) {
    const cart = await this.getOrCreateCart(customerId);
    const items = await this.itemRepo().find({
      where: { cart: { id: cart.id } },
      order: { createdAt: 'ASC' },
    });
    const lines = items.map((i) => ({
      id: i.id,
      productId: i.productId,
      vendorId: i.vendorId,
      variationId: i.variationId ?? null,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      metadata: i.metadata,
      lineTotal: (Number(i.unitPrice) * i.quantity).toFixed(2),
    }));
    const subtotal = lines.reduce((s, l) => s + Number(l.lineTotal), 0);
    return {
      id: cart.id,
      customerId: cart.customerId,
      items: lines,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      subtotal: subtotal.toFixed(2),
      currency: 'INR',
    };
  }

  async replaceCart(customerId: string, lines: CartLineInput[]) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      let cart = await queryRunner.manager.findOne(Cart, { where: { customerId } });
      if (!cart) {
        cart = queryRunner.manager.create(Cart, { id: randomUUID(), customerId });
        cart = await queryRunner.manager.save(cart);
      } else {
        await queryRunner.manager
          .createQueryBuilder()
          .delete()
          .from(CartItem)
          .where('cart_id = :id', { id: cart.id })
          .execute();
      }
      for (const line of lines) {
        const item = queryRunner.manager.create(CartItem, {
          id: randomUUID(),
          cart,
          productId: String(line.productId).slice(0, 64),
          vendorId: normalizeVendorId(line.vendorId),
          variationId: normalizeVariationId(line.variationId),
          quantity: clampQty(line.quantity),
          unitPrice: formatPrice(line.unitPrice),
          metadata: line.metadata ?? null,
        });
        await queryRunner.manager.save(item);
      }
      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
    return this.getCartResponse(customerId);
  }

  async addItem(customerId: string, line: CartLineInput) {
    const cart = await this.getOrCreateCart(customerId);
    const items = await this.itemRepo().find({ where: { cart: { id: cart.id } } });
    const pid = String(line.productId).slice(0, 64);
    const vid = normalizeVendorId(line.vendorId);
    const varId = normalizeVariationId(line.variationId);
    const qty = clampQty(line.quantity);
    const price = formatPrice(line.unitPrice);
    const key = cartLineKey(pid, vid, varId);
    const match = items.find(
      (i) => cartLineKey(i.productId, i.vendorId ?? null, i.variationId ?? null) === key,
    );
    if (match) {
      match.quantity = clampQty(match.quantity + qty);
      if (line.metadata != null) {
        match.metadata = { ...(match.metadata || {}), ...line.metadata };
      }
      await this.itemRepo().save(match);
    } else {
      const item = this.itemRepo().create({
        id: randomUUID(),
        cart,
        productId: pid,
        vendorId: vid,
        variationId: varId,
        quantity: qty,
        unitPrice: price,
        metadata: line.metadata ?? null,
      });
      await this.itemRepo().save(item);
    }
    return this.getCartResponse(customerId);
  }

  async updateItem(customerId: string, itemId: string, patch: { quantity?: number; unitPrice?: string | number }) {
    const cart = await this.getOrCreateCart(customerId);
    const item = await this.itemRepo().findOne({
      where: { id: itemId, cart: { id: cart.id } },
    });
    if (!item) throw new Error('Cart item not found');
    if (patch.quantity !== undefined) item.quantity = clampQty(patch.quantity);
    if (patch.unitPrice !== undefined) item.unitPrice = formatPrice(patch.unitPrice);
    await this.itemRepo().save(item);
    return this.getCartResponse(customerId);
  }

  async removeItem(customerId: string, itemId: string) {
    const cart = await this.getOrCreateCart(customerId);
    const res = await this.itemRepo()
      .createQueryBuilder()
      .delete()
      .from(CartItem)
      .where('id = :iid AND cart_id = :cid', { iid: itemId, cid: cart.id })
      .execute();
    if (!res.affected) throw new Error('Cart item not found');
    return this.getCartResponse(customerId);
  }

  async clearCart(customerId: string) {
    const cart = await this.cartRepo().findOne({ where: { customerId } });
    if (cart) {
      await this.itemRepo()
        .createQueryBuilder()
        .delete()
        .from(CartItem)
        .where('cart_id = :id', { id: cart.id })
        .execute();
    }
    return this.getCartResponse(customerId);
  }

  async mergeItems(customerId: string, lines: CartLineInput[]) {
    for (const line of lines) {
      await this.addItem(customerId, line);
    }
    return this.getCartResponse(customerId);
  }

  /**
   * Creates an order from the current server cart with full pricing breakdown applied.
   * - Validates min cart value
   * - Computes commission per line + per-vendor settlement rows
   * - Debits redeemed points from RewardPointsLedger
   * - Persists totals into order.metadata.totals
   * Then clears the cart.
   */
  /**
   * Decrement catalog stock for order lines (best-effort on metadata.quantity /
   * metadata.variations[].quantity). Never blocks checkout if stock fields are absent.
   */
  static async decrementStockForLines(
    manager: typeof AppDataSource.manager,
    lines: Array<{ productId?: string; quantity?: number; metadata?: Record<string, unknown> | null }>,
  ) {
    const byProduct = new Map<string, number>();
    for (const line of lines) {
      const pid = String(line.productId || '').trim();
      if (!pid) continue;
      byProduct.set(pid, (byProduct.get(pid) || 0) + Math.max(0, Number(line.quantity) || 0));
    }
    if (!byProduct.size) return;
    const products = await manager.getRepository(Product).find({
      where: { id: In([...byProduct.keys()]) },
    });
    for (const product of products) {
      const take = byProduct.get(product.id) || 0;
      if (take <= 0) continue;
      const meta = { ...(product.metadata && typeof product.metadata === 'object' ? product.metadata : {}) };
      const rawQty = Number((meta as any).quantity ?? (meta as any).stock ?? (meta as any).stockQty);
      if (Number.isFinite(rawQty)) {
        (meta as any).quantity = Math.max(0, rawQty - take);
      }
      const lineMeta = lines.find((l) => l.productId === product.id)?.metadata;
      const variationId = String(
        (lineMeta as any)?.variationId || (lineMeta as any)?.variation_id || '',
      ).trim();
      const variations = Array.isArray((meta as any).variations) ? [...(meta as any).variations] : null;
      if (variationId && variations) {
        (meta as any).variations = variations.map((v: any) => {
          if (!v || typeof v !== 'object') return v;
          const vid = String(v.id || v.variationId || '').trim();
          if (vid !== variationId) return v;
          const vq = Number(v.quantity ?? v.stock);
          if (!Number.isFinite(vq)) return v;
          return { ...v, quantity: Math.max(0, vq - take) };
        });
      }
      product.metadata = meta;
      await manager.getRepository(Product).save(product);
    }
  }

  /** Apply coupon + points + stock that were deferred until online payment succeeded. */
  static async applyDeferredCheckoutSideEffects(
    manager: typeof AppDataSource.manager,
    order: Order,
  ) {
    const meta = order.metadata && typeof order.metadata === 'object' ? { ...order.metadata } : {};
    if (meta.sideEffectsApplied) return order;

    const couponId = String(meta.couponId || meta.pendingCouponId || '').trim();
    const discount = Number(meta.pendingDiscount ?? (meta.totals as any)?.discount ?? 0);
    if (couponId && discount > 0 && !meta.couponUsageRecorded) {
      const couponSvc = new CouponService();
      await couponSvc.recordUsage({
        couponId,
        customerId: String(order.customerId || ''),
        orderId: order.id,
        discountApplied: discount,
        manager,
      });
      meta.couponUsageRecorded = true;
    }

    const pointsRedeemed = Number(meta.pendingPointsRedeemed ?? (meta.totals as any)?.pointsRedeemed ?? 0);
    const walletBefore = Number(meta.pendingWalletBalanceBefore ?? (meta.totals as any)?.walletBalanceBefore ?? 0);
    if (pointsRedeemed > 0 && !meta.pointsDebited) {
      const profileRepo = manager.getRepository(CustomerProfile);
      const cid = String(order.customerId || '').trim();
      let profile = cid
        ? (await profileRepo.findOne({ where: { id: cid } })) ||
          (await profileRepo.findOne({ where: { keycloakUserId: cid } }))
        : null;
      if (profile?.id) {
        await manager.getRepository(RewardPointsLedger).save(
          manager.getRepository(RewardPointsLedger).create({
            id: randomUUID(),
            customerId: profile.id,
            points: -pointsRedeemed,
            balanceAfter: walletBefore - pointsRedeemed,
            type: 'order_redeem',
            referenceId: order.id,
            description: 'Points redeemed at checkout',
            metadata: {
              orderRef: order.orderRef,
              orderId: order.id,
              value: meta.pendingPointsRedeemedValue ?? (meta.totals as any)?.pointsRedeemedValue,
            },
          }),
        );
        await manager.getRepository(Settlement).save(
          manager.getRepository(Settlement).create({
            vendorId: order.vendorId,
            orderId: order.id,
            settlementType: 'points',
            status: 'posted',
            amount: String(-pointsRedeemed),
            metadata: {
              customerId: profile.id,
              type: 'order_redeem',
              orderRef: order.orderRef,
              description: 'Points redeemed at checkout',
            },
          }),
        );
        profile.metadata = {
          ...(profile.metadata || {}),
          wallet: walletBefore - pointsRedeemed,
          walletBalance: walletBefore - pointsRedeemed,
        };
        await profileRepo.save(profile);
        meta.pointsDebited = true;
      }
    }

    const lines = Array.isArray(meta.lines) ? meta.lines : [];
    if (!meta.stockDecremented && lines.length) {
      await CartService.decrementStockForLines(manager, lines as any[]);
      meta.stockDecremented = true;
    }

    // Clear any remaining cart items that match this checkout (idempotent).
    if (!meta.cartClearedOnPay && meta.cartId) {
      await manager
        .createQueryBuilder()
        .delete()
        .from(CartItem)
        .where('cart_id = :id', { id: meta.cartId })
        .execute();
      meta.cartClearedOnPay = true;
    }

    meta.sideEffectsApplied = true;
    meta.sideEffectsPending = false;
    order.metadata = meta;
    return manager.getRepository(Order).save(order);
  }

  async createOrderFromCart(
    customerId: string,
    vendorId?: string | null,
    opts: {
      redeemPoints?: number;
      couponCode?: string;
      addressId?: string;
      shippingAddress?: Record<string, unknown> | null;
      paymentMode?: string;
      deliverySchedule?: Record<string, unknown> | null;
    } = {},
  ): Promise<Order & { orders?: Order[] }> {
    const data = await this.getCartResponse(customerId);
    if (!data.items.length) {
      throw new Error('Cart is empty');
    }

    const addressId = String(opts.addressId || '').trim();
    if (!addressId) {
      throw new Error('Delivery address is required');
    }
    const shippingAddress =
      opts.shippingAddress && typeof opts.shippingAddress === 'object'
        ? opts.shippingAddress
        : null;
    if (!shippingAddress) {
      throw new Error('Delivery address snapshot is required');
    }

    const deliverySchedule =
      opts.deliverySchedule && typeof opts.deliverySchedule === 'object'
        ? opts.deliverySchedule
        : null;

    const breakdown = await this.pricing.priceCart(
      customerId,
      data.items.map((i) => ({
        productId: i.productId,
        vendorId: i.vendorId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        metadata: i.metadata,
      })),
      {
        redeemPoints: opts.redeemPoints,
        couponCode: opts.couponCode,
        vendorId: vendorId ?? undefined,
        requireValidCoupon: Boolean(String(opts.couponCode || '').trim()),
      },
    );

    if (!breakdown.meetsMinCart) {
      throw new Error(`Cart subtotal ${breakdown.itemSubtotal} below minimum ${breakdown.minCartValue}`);
    }

    const lineProductIds = [
      ...new Set(data.items.map((i) => i.productId).filter(Boolean) as string[]),
    ];
    const productNameById = new Map<string, string>();
    if (lineProductIds.length) {
      const prods = await AppDataSource.getRepository(Product).find({
        where: { id: In(lineProductIds) },
      });
      for (const p of prods) productNameById.set(p.id, p.name);
    }

    const lines = data.items.map((i) => ({
      productId: i.productId,
      vendorId: i.vendorId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      metadata: {
        ...(i.metadata ?? {}),
        productName:
          (i.metadata as Record<string, unknown> | null | undefined)?.productName ??
          productNameById.get(i.productId) ??
          undefined,
      },
    }));

    // Split into one order per vendor so each vendor owns their lines.
    const linesByVendor = new Map<string, typeof lines>();
    for (const line of lines) {
      const key = normalizeVendorId(line.vendorId) || '_none';
      const bucket = linesByVendor.get(key) || [];
      bucket.push(line);
      linesByVendor.set(key, bucket);
    }

    const profileRepo = AppDataSource.getRepository(CustomerProfile);
    let profile = await profileRepo.findOne({ where: { id: customerId } });
    if (!profile) {
      profile = await profileRepo.findOne({ where: { keycloakUserId: customerId } });
    }
    const customerSnapshot =
      profile != null
        ? {
            customerName: profile.fullName,
            customerPhone: profile.phone ?? undefined,
            customerEmail: profile.email ?? undefined,
            customerProfileId: profile.id,
          }
        : {};

    const paymentMode = String(opts.paymentMode || 'cod').trim().toLowerCase() || 'cod';
    const isCod = paymentMode === 'cod';

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const orderRepo = queryRunner.manager.getRepository(Order);
      const settlementRepo = queryRunner.manager.getRepository(Settlement);
      const created: Order[] = [];
      const stamp = Date.now();
      let vendorIndex = 0;

      for (const [vendorKey, vendorLines] of linesByVendor) {
        const resolvedVendor = vendorKey === '_none' ? normalizeVendorId(vendorId) : vendorKey;
        const vendorBreakdown = breakdown.vendors.find((v) => String(v.vendorId) === String(resolvedVendor));
        const vendorSubtotal = vendorLines.reduce((s, l) => s + Number(l.lineTotal || 0), 0);
        // Allocate coupon/points proportionally across vendor orders; primary order holds redeem bookkeeping.
        const share =
          Number(breakdown.itemSubtotal) > 0 ? vendorSubtotal / Number(breakdown.itemSubtotal) : 1 / linesByVendor.size;
        // Prefer vendor row totals when available; else line sum.
        let amount = vendorBreakdown
          ? Number(vendorBreakdown.subtotal) -
            Number(breakdown.discount) * share +
            Number(breakdown.deliveryFee || 0) * share +
            Number(breakdown.platformFee || 0) * share -
            Number(breakdown.pointsRedeemedValue || 0) * share
          : vendorSubtotal;
        if (!Number.isFinite(amount) || amount < 0) amount = Math.max(0, vendorSubtotal);

        const isPrimary = vendorIndex === 0;
        const order = orderRepo.create({
          id: randomUUID(),
          customerId,
          vendorId: resolvedVendor,
          orderRef: `ORD-${stamp}${linesByVendor.size > 1 ? `-${vendorIndex + 1}` : ''}`,
          status: isCod ? 'placed' : 'created',
          totalAmount: Number(amount.toFixed(2)).toFixed(2),
          metadata: {
            source: 'cart',
            cartId: data.id,
            lines: vendorLines,
            multiVendor: linesByVendor.size > 1,
            siblingOrderIds: [] as string[],
            totals: {
              ...breakdown,
              itemSubtotal: String(vendorSubtotal.toFixed(2)),
              grandTotal: String(Number(amount.toFixed(2))),
              vendorShare: share,
            },
            cartTotals: breakdown,
            vendorName:
              vendorBreakdown?.vendorName ??
              breakdown.vendors.find((v) => v.vendorName)?.vendorName ??
              undefined,
            addressId,
            shippingAddress,
            deliverySchedule,
            paymentMode,
            paymentStatus: isCod ? 'cod' : 'pending',
            couponCode: breakdown.couponCode,
            couponId: breakdown.couponId,
            pendingCouponId: !isCod && isPrimary ? breakdown.couponId : null,
            pendingDiscount: !isCod && isPrimary ? Number(breakdown.discount) : 0,
            pendingPointsRedeemed: !isCod && isPrimary ? Number(breakdown.pointsRedeemed) : 0,
            pendingPointsRedeemedValue: !isCod && isPrimary ? breakdown.pointsRedeemedValue : 0,
            pendingWalletBalanceBefore: !isCod && isPrimary ? breakdown.walletBalanceBefore : 0,
            sideEffectsPending: !isCod && isPrimary,
            sideEffectsApplied: isCod,
            ...customerSnapshot,
          },
        });
        await orderRepo.save(order);
        created.push(order);

        if (resolvedVendor) {
          await settlementRepo.save(
            settlementRepo.create({
              id: randomUUID(),
              vendorId: resolvedVendor,
              orderId: order.id,
              settlementType: 'cash',
              status: 'pending',
              amount: vendorBreakdown?.netToVendor ?? String(vendorSubtotal.toFixed(2)),
              metadata: {
                orderRef: order.orderRef,
                vendorSubtotal: vendorBreakdown?.subtotal ?? vendorSubtotal,
                commissionTotal: vendorBreakdown?.commissionTotal ?? 0,
                vendorName: vendorBreakdown?.vendorName,
              },
            }),
          );
        }
        vendorIndex += 1;
      }

      // Link siblings for multi-vendor checkouts.
      if (created.length > 1) {
        const ids = created.map((o) => o.id);
        for (const order of created) {
          const meta = { ...(order.metadata as Record<string, unknown>) };
          meta.siblingOrderIds = ids.filter((id) => id !== order.id);
          order.metadata = meta;
          await orderRepo.save(order);
        }
      }

      const primary = created[0];

      if (isCod) {
        if (breakdown.couponId && Number(breakdown.discount) > 0) {
          const couponSvc = new CouponService();
          await couponSvc.recordUsage({
            couponId: breakdown.couponId,
            customerId,
            orderId: primary.id,
            discountApplied: Number(breakdown.discount),
            manager: queryRunner.manager,
          });
          const meta = { ...(primary.metadata as Record<string, unknown>), couponUsageRecorded: true };
          primary.metadata = meta;
          await orderRepo.save(primary);
        }

        if (breakdown.pointsRedeemed > 0 && profile?.id) {
          const ledgerRepo = queryRunner.manager.getRepository(RewardPointsLedger);
          await ledgerRepo.save(
            ledgerRepo.create({
              id: randomUUID(),
              customerId: profile.id,
              points: -breakdown.pointsRedeemed,
              balanceAfter: breakdown.walletBalanceBefore - breakdown.pointsRedeemed,
              type: 'order_redeem',
              referenceId: primary.id,
              description: 'Points redeemed at checkout',
              metadata: {
                orderRef: primary.orderRef,
                orderId: primary.id,
                value: breakdown.pointsRedeemedValue,
              },
            }),
          );
          await settlementRepo.save(
            settlementRepo.create({
              vendorId: primary.vendorId,
              orderId: primary.id,
              settlementType: 'points',
              status: 'posted',
              amount: String(-breakdown.pointsRedeemed),
              metadata: {
                customerId: profile.id,
                type: 'order_redeem',
                orderRef: primary.orderRef,
                description: 'Points redeemed at checkout',
              },
            }),
          );
          profile.metadata = {
            ...(profile.metadata || {}),
            wallet: breakdown.walletBalanceBefore - breakdown.pointsRedeemed,
            walletBalance: breakdown.walletBalanceBefore - breakdown.pointsRedeemed,
          };
          await queryRunner.manager.getRepository(CustomerProfile).save(profile);
        }

        await CartService.decrementStockForLines(queryRunner.manager, lines as any[]);
        for (const order of created) {
          const meta = { ...(order.metadata as Record<string, unknown>), stockDecremented: true };
          order.metadata = meta;
          await orderRepo.save(order);
        }

        await queryRunner.manager
          .createQueryBuilder()
          .delete()
          .from(CartItem)
          .where('cart_id = :id', { id: data.id })
          .execute();
      }
      // Online: leave cart + coupon + points until payment capture (see applyDeferredCheckoutSideEffects).

      await queryRunner.commitTransaction();
      await this.customerReferralRewards.applyAfterFirstPurchase(customerId, primary.id).catch((error) => {
        console.error('[commerce] first-purchase referral reward failed:', error);
      });

      // Fire-and-forget vendor notifications (best effort).
      void CartService.notifyVendorsOfNewOrders(created).catch(() => undefined);

      if (created.length === 1) return primary;
      return Object.assign(primary, { orders: created });
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  static async notifyVendorsOfNewOrders(orders: Order[]) {
    const base = process.env.NOTIFICATION_SERVICE_URL || process.env.GATEWAY_INTERNAL_URL || '';
    if (!base) return;
    for (const order of orders) {
      if (!order.vendorId) continue;
      const meta = (order.metadata || {}) as Record<string, unknown>;
      try {
        await fetch(`${String(base).replace(/\/$/, '')}/api/v1/notifications/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: order.vendorId,
            title: 'New order received',
            body: `Order ${order.orderRef || order.id} — ₹${order.totalAmount}`,
            data: {
              type: 'product_order',
              orderId: order.id,
              paymentMode: meta.paymentMode,
            },
          }),
        }).catch(() => undefined);
      } catch {
        // ignore
      }
    }
  }
}
