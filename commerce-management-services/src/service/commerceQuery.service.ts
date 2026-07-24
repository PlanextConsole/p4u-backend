import { randomUUID } from 'crypto';
import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Order } from '../entities/Order';
import { CustomerProfile } from '../entities/CustomerProfile';
import { CustomerReferralRewardService } from './customerReferralReward.service';

export class CommerceQueryService {
  private customerReferralRewards = new CustomerReferralRewardService();

  /** Resolve JWT sub / profile id aliases so order lists don't miss rows. */
  private async customerIdAliases(customerId: string): Promise<string[]> {
    const id = String(customerId || '').trim();
    if (!id) return [];
    const ids = new Set<string>([id]);
    const profileRepo = AppDataSource.getRepository(CustomerProfile);
    const byId = await profileRepo.findOne({ where: { id } });
    const byKeycloak =
      byId ?? (await profileRepo.findOne({ where: { keycloakUserId: id } }));
    if (byKeycloak) {
      ids.add(byKeycloak.id);
      if (byKeycloak.keycloakUserId) ids.add(String(byKeycloak.keycloakUserId));
    }
    return [...ids];
  }

  async listCustomerOrders(customerId: string, limit: number, offset: number) {
    const ids = await this.customerIdAliases(customerId);
    if (!ids.length) return [[], 0] as [Order[], number];
    return AppDataSource.getRepository(Order).findAndCount({
      where: { customerId: In(ids) },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
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
