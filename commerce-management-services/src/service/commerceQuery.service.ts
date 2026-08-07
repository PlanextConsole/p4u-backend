import { randomUUID } from 'crypto';
import { Brackets } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Order } from '../entities/Order';
import { CustomerReferralRewardService } from './customerReferralReward.service';
import { resolveCustomerIdAliases } from '../utils/customerIdentity';

export class CommerceQueryService {
  private customerReferralRewards = new CustomerReferralRewardService();

  /** Resolve JWT sub / profile id aliases so order lists don't miss rows. */
  private async customerIdAliases(customerId: string): Promise<string[]> {
    return resolveCustomerIdAliases(customerId);
  }

  async listCustomerOrders(customerId: string, limit: number, offset: number) {
    const ids = await this.customerIdAliases(customerId);
    if (!ids.length) return [[], 0] as [Order[], number];
    // Historical checkout versions could persist either the Keycloak subject or
    // the profile UUID in customer_id. The immutable checkout snapshot is a
    // second ownership signal, so include it instead of silently hiding a paid
    // order when one of those identifiers was written by an older process.
    const qb = AppDataSource.getRepository(Order)
      .createQueryBuilder('o')
      .where(
        new Brackets((where) => {
          where
            .where('o.customer_id IN (:...ids)', { ids })
            .orWhere("o.metadata ->> 'customerProfileId' IN (:...ids)", { ids })
            .orWhere("o.metadata ->> 'customerKeycloakUserId' IN (:...ids)", { ids });
        }),
      )
      .orderBy('o.created_at', 'DESC')
      .take(limit)
      .skip(offset);
    return qb.getManyAndCount();
  }

  async getOrderById(id: string) {
    return AppDataSource.getRepository(Order).findOne({ where: { id } });
  }

  async customerOwnsOrder(tokenCustomerId: string, order: Order): Promise<boolean> {
    const aliases = await this.customerIdAliases(tokenCustomerId);
    if (aliases.includes(String(order.customerId || ''))) return true;
    const meta = (order.metadata || {}) as Record<string, unknown>;
    const profileId = meta.customerProfileId != null ? String(meta.customerProfileId) : '';
    return Boolean(profileId && aliases.includes(profileId));
  }

  async createOrder(input: {
    customerId: string;
    vendorId?: string | null;
    totalAmount?: string;
    metadata?: Record<string, unknown> | null;
  }) {
    const repo = AppDataSource.getRepository(Order);
    const row = repo.create({
      id: randomUUID(),
      customerId: input.customerId,
      vendorId: input.vendorId ?? null,
      orderRef: `ORD-${Date.now()}`,
      status: 'created',
      totalAmount: input.totalAmount ?? '0',
      metadata: input.metadata ?? null,
    });
    const saved = await repo.save(row);
    await this.customerReferralRewards.applyAfterFirstPurchase(input.customerId, saved.id).catch((error) => {
      console.error('[commerce] first-purchase referral reward failed:', error);
    });
    return saved;
  }

  /** Early lifecycle statuses that customers (and non-admin cancel) may cancel from. */
  static readonly CANCELLABLE_STATUSES = new Set([
    'created',
    'placed',
    'pending',
    'paid',
    'accepted',
    'processing',
    'in_progress',
    'new',
  ]);

  async updateOrderStatus(orderId: string, status: string) {
    const repo = AppDataSource.getRepository(Order);
    const row = await repo.findOne({ where: { id: orderId } });
    if (!row) throw new Error('Order not found');
    row.status = status;
    return repo.save(row);
  }

  async cancelCustomerOrder(orderId: string) {
    const repo = AppDataSource.getRepository(Order);
    const row = await repo.findOne({ where: { id: orderId } });
    if (!row) throw new Error('Order not found');
    const current = String(row.status || '').trim().toLowerCase();
    if (current === 'cancelled' || current === 'canceled') {
      throw new Error('Order is already cancelled');
    }
    if (!CommerceQueryService.CANCELLABLE_STATUSES.has(current)) {
      throw new Error('This order can no longer be cancelled');
    }
    row.status = 'cancelled';
    return repo.save(row);
  }
}
