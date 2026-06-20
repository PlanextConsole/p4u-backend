import { AppDataSource } from '../config/database';
import { Cart } from '../entities/Cart';
import { CartItem } from '../entities/CartItem';
import { CustomerProfile } from '../entities/CustomerProfile';
import { Settlement } from '../entities/Settlement';
import { RewardPointsLedger } from '../entities/RewardPointsLedger';
import { Order } from '../entities/Order';
import { CommerceQueryService } from './commerceQuery.service';
import { PricingService, type CartPricingBreakdown } from './pricing.service';

export type CartLineInput = {
  productId: string;
  vendorId?: string | null;
  quantity: number;
  unitPrice: string | number;
  metadata?: Record<string, unknown> | null;
};

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
  private commerce = new CommerceQueryService();
  private pricing = new PricingService();

  /** Returns a full pre-checkout breakdown without persisting anything. */
  async quoteCart(customerId: string, opts: { redeemPoints?: number } = {}): Promise<CartPricingBreakdown & { cartId: string }> {
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
      cart = this.cartRepo().create({ customerId });
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
        cart = queryRunner.manager.create(Cart, { customerId });
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
          cart,
          productId: String(line.productId).slice(0, 64),
          vendorId: normalizeVendorId(line.vendorId),
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
    const qty = clampQty(line.quantity);
    const price = formatPrice(line.unitPrice);
    const match = items.find((i) => i.productId === pid && (i.vendorId ?? null) === vid);
    if (match) {
      match.quantity = clampQty(match.quantity + qty);
      if (line.metadata != null) {
        match.metadata = { ...(match.metadata || {}), ...line.metadata };
      }
      await this.itemRepo().save(match);
    } else {
      const item = this.itemRepo().create({
        cart,
        productId: pid,
        vendorId: vid,
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
  async createOrderFromCart(
    customerId: string,
    vendorId?: string | null,
    opts: { redeemPoints?: number } = {},
  ): Promise<ReturnType<CommerceQueryService['createOrder']>> {
    const data = await this.getCartResponse(customerId);
    if (!data.items.length) {
      throw new Error('Cart is empty');
    }

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

    if (!breakdown.meetsMinCart) {
      throw new Error(`Cart subtotal ${breakdown.itemSubtotal} below minimum ${breakdown.minCartValue}`);
    }

    const lines = data.items.map((i) => ({
      productId: i.productId,
      vendorId: i.vendorId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      metadata: i.metadata,
    }));
    const vendorIds = new Set(lines.map((l) => l.vendorId ?? ''));
    let resolvedVendor = normalizeVendorId(vendorId);
    if (!resolvedVendor && vendorIds.size === 1) {
      const only = [...vendorIds][0];
      resolvedVendor = only === '' ? null : only;
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

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const orderRepo = queryRunner.manager.getRepository(Order);
      const order = orderRepo.create({
        customerId,
        vendorId: resolvedVendor,
        orderRef: `ORD-${Date.now()}`,
        status: 'created',
        totalAmount: breakdown.grandTotal,
        metadata: {
          source: 'cart',
          cartId: data.id,
          lines,
          multiVendor: vendorIds.size > 1,
          totals: breakdown,
          ...customerSnapshot,
        },
      });
      await orderRepo.save(order);

      // One settlement row per vendor for the cash split.
      const settlementRepo = queryRunner.manager.getRepository(Settlement);
      for (const v of breakdown.vendors) {
        await settlementRepo.save(
          settlementRepo.create({
            vendorId: v.vendorId,
            orderId: order.id,
            settlementType: 'cash',
            status: 'pending',
            amount: v.netToVendor,
            metadata: {
              orderRef: order.orderRef,
              vendorSubtotal: v.subtotal,
              commissionTotal: v.commissionTotal,
              vendorName: v.vendorName,
            },
          }),
        );
      }

      // Debit redeemed wallet points if any.
      if (breakdown.pointsRedeemed > 0 && profile?.id) {
        const ledgerRepo = queryRunner.manager.getRepository(RewardPointsLedger);
        await ledgerRepo.save(
          ledgerRepo.create({
            customerId: profile.id,
            points: -breakdown.pointsRedeemed,
            balanceAfter: breakdown.walletBalanceBefore - breakdown.pointsRedeemed,
            type: 'order_redeem',
            referenceId: order.id,
            description: 'Points redeemed at checkout',
            metadata: { orderRef: order.orderRef, orderId: order.id, value: breakdown.pointsRedeemedValue },
          }),
        );
        // Mirror the running wallet balance into customer metadata.
        const merged = { ...(profile.metadata || {}), wallet: breakdown.walletBalanceBefore - breakdown.pointsRedeemed, walletBalance: breakdown.walletBalanceBefore - breakdown.pointsRedeemed };
        profile.metadata = merged;
        await queryRunner.manager.getRepository(CustomerProfile).save(profile);
      }

      // Clear cart inside the same transaction.
      await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from(CartItem)
        .where('cart_id = :id', { id: data.id })
        .execute();

      await queryRunner.commitTransaction();
      return order;
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }
}
