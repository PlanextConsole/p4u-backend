import { Brackets } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { Customer } from '../customers/entities/Customer';
import { Order } from './entities/Order';
import { Settlement } from './entities/Settlement';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { UpdateSettlementDto } from './dto/update-settlement.dto';

export class OrdersAdminService {
  private audit = new AuditService();

  async listOrders(limit: number, offset: number): Promise<{ items: Order[]; total: number }> {
    const repo = AppDataSource.getRepository(Order);
    const [items, total] = await repo.findAndCount({ order: { createdAt: 'DESC' }, take: limit, skip: offset });
    return { items, total };
  }

  async getOrder(id: string): Promise<Order | null> {
    return AppDataSource.getRepository(Order).findOne({ where: [{ id }, { orderRef: id }] });
  }

  async listOrdersByVendor(vendorId: string, limit: number, offset: number): Promise<{ items: Order[]; total: number }> {
    const repo = AppDataSource.getRepository(Order);
    const [items, total] = await repo.findAndCount({ where: { vendorId }, order: { createdAt: 'DESC' }, take: limit, skip: offset });
    return { items, total };
  }

  /**
   * Orders may store `customer_id` as Keycloak `sub`, explicit JWT `customer_id`, or profile UUID.
   * Cart checkout also writes `metadata.customerProfileId`. Admin passes `customer_profiles.id`.
   */
  async listOrdersByCustomer(customerId: string, limit: number, offset: number): Promise<{ items: Order[]; total: number }> {
    const idSet = new Set<string>();
    idSet.add(customerId);
    const customer = await AppDataSource.getRepository(Customer).findOne({
      where: [{ id: customerId }, { keycloakUserId: customerId }],
    });
    if (customer?.id) idSet.add(customer.id);
    if (customer?.keycloakUserId) idSet.add(customer.keycloakUserId);
    const ids = [...idSet].filter((x) => Boolean(x && String(x).trim()));

    const repo = AppDataSource.getRepository(Order);
    const qb = repo
      .createQueryBuilder('o')
      .where(
        new Brackets((w) => {
          w.where('o.customerId IN (:...ids)', { ids }).orWhere(
            "JSON_UNQUOTE(JSON_EXTRACT(o.metadata, '$.customerProfileId')) IN (:...ids)",
            { ids },
          );
        }),
      )
      .orderBy('o.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async createOrder(dto: CreateOrderDto, actorSub: string, ip: string | undefined): Promise<Order> {
    const repo = AppDataSource.getRepository(Order);
    const row = repo.create({
      vendorId: dto.vendorId ?? null,
      customerId: dto.customerId ?? null,
      orderRef: dto.orderRef ?? null,
      status: dto.status ?? 'created',
      totalAmount: dto.totalAmount ?? '0',
      metadata: dto.metadata ?? null,
    });
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'Order', entityId: row.id, metadata: { orderRef: row.orderRef }, ipAddress: ip ?? null });
    return row;
  }

  async updateOrder(id: string, dto: UpdateOrderDto, actorSub: string, ip: string | undefined): Promise<Order> {
    const repo = AppDataSource.getRepository(Order);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Order not found');
    if (dto.vendorId !== undefined) row.vendorId = dto.vendorId;
    if (dto.customerId !== undefined) row.customerId = dto.customerId;
    if (dto.orderRef !== undefined) row.orderRef = dto.orderRef;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.totalAmount !== undefined) row.totalAmount = dto.totalAmount;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'Order', entityId: row.id, metadata: { changes: dto }, ipAddress: ip ?? null });
    return row;
  }

  async listSettlements(kind: 'all' | 'cash' | 'points', limit: number, offset: number): Promise<{ items: Settlement[]; total: number }> {
    const repo = AppDataSource.getRepository(Settlement);
    const where = kind === 'all' ? {} : { settlementType: kind };
    const [items, total] = await repo.findAndCount({ where, order: { createdAt: 'DESC' }, take: limit, skip: offset });
    return { items, total };
  }

  async getSettlement(id: string): Promise<Settlement | null> {
    return AppDataSource.getRepository(Settlement).findOne({ where: { id } });
  }

  async getSettlementByVendorSingle(vendorId: string): Promise<Settlement | null> {
    return AppDataSource.getRepository(Settlement).findOne({ where: { vendorId }, order: { createdAt: 'DESC' } });
  }

  async createSettlement(dto: CreateSettlementDto, actorSub: string, ip: string | undefined): Promise<Settlement> {
    const repo = AppDataSource.getRepository(Settlement);
    const row = repo.create({
      vendorId: dto.vendorId ?? null,
      orderId: dto.orderId ?? null,
      settlementType: dto.settlementType ?? 'cash',
      status: dto.status ?? 'pending',
      amount: dto.amount ?? '0',
      documentUrl: dto.documentUrl ?? null,
      metadata: dto.metadata ?? null,
    });
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'Settlement', entityId: row.id, metadata: { settlementType: row.settlementType }, ipAddress: ip ?? null });
    return row;
  }

  private static readonly ACTIVE_STATUSES = [
    'placed',
    'paid',
    'accepted',
    'in_progress',
    'delivered',
    'pending',
    'created',
    'order_await_completion',
  ];

  async getOrderStats(filters?: {
    status?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<{ total: number; revenue: number; active: number; completed: number }> {
    const repo = AppDataSource.getRepository(Order);
    const qb = repo.createQueryBuilder('o');

    if (filters?.status?.trim()) {
      qb.andWhere('LOWER(o.status) = :status', { status: filters.status.trim().toLowerCase() });
    }
    if (filters?.fromDate?.trim()) {
      qb.andWhere('o.created_at >= :fromDate', { fromDate: filters.fromDate.trim() });
    }
    if (filters?.toDate?.trim()) {
      const end = new Date(filters.toDate.trim());
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        qb.andWhere('o.created_at <= :toDate', { toDate: end });
      }
    }

    const total = await qb.clone().getCount();
    const revenueRaw = await qb
      .clone()
      .select('COALESCE(SUM(o.total_amount), 0)', 'revenue')
      .getRawOne();
    const revenue = Number(revenueRaw?.revenue || 0);

    const active = await qb
      .clone()
      .andWhere('LOWER(o.status) IN (:...activeStatuses)', {
        activeStatuses: OrdersAdminService.ACTIVE_STATUSES,
      })
      .getCount();

    const completed = await qb
      .clone()
      .andWhere('LOWER(o.status) = :completed', { completed: 'completed' })
      .getCount();

    return { total, revenue, active, completed };
  }

  async updateSettlement(id: string, dto: UpdateSettlementDto, actorSub: string, ip: string | undefined): Promise<Settlement> {
    const repo = AppDataSource.getRepository(Settlement);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Settlement not found');
    if (dto.vendorId !== undefined) row.vendorId = dto.vendorId;
    if (dto.orderId !== undefined) row.orderId = dto.orderId;
    if (dto.settlementType !== undefined) row.settlementType = dto.settlementType;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.amount !== undefined) row.amount = dto.amount;
    if (dto.documentUrl !== undefined) row.documentUrl = dto.documentUrl;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'Settlement', entityId: row.id, metadata: { changes: dto }, ipAddress: ip ?? null });
    return row;
  }
}
