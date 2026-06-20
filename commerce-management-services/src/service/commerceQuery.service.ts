import { AppDataSource } from '../config/database';
import { Order } from '../entities/Order';

export class CommerceQueryService {
  async listCustomerOrders(customerId: string, limit: number, offset: number) {
    return AppDataSource.getRepository(Order).findAndCount({
      where: { customerId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getOrderById(id: string) {
    return AppDataSource.getRepository(Order).findOne({ where: { id } });
  }

  async createOrder(input: {
    customerId: string;
    vendorId?: string | null;
    totalAmount?: string;
    metadata?: Record<string, unknown> | null;
  }) {
    const repo = AppDataSource.getRepository(Order);
    const row = repo.create({
      customerId: input.customerId,
      vendorId: input.vendorId ?? null,
      orderRef: `ORD-${Date.now()}`,
      status: 'created',
      totalAmount: input.totalAmount ?? '0',
      metadata: input.metadata ?? null,
    });
    return repo.save(row);
  }

  async updateOrderStatus(orderId: string, status: string) {
    const repo = AppDataSource.getRepository(Order);
    const row = await repo.findOne({ where: { id: orderId } });
    if (!row) throw new Error('Order not found');
    row.status = status;
    return repo.save(row);
  }
}
