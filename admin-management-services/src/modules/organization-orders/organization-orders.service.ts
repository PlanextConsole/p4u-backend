import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { OrganizationOrder } from './entities/OrganizationOrder';
import { CreateOrganizationOrderDto } from './dto/create-organization-order.dto';
import { UpdateOrganizationOrderDto } from './dto/update-organization-order.dto';

export class OrganizationOrdersAdminService {
  private audit = new AuditService();

  async listAll(limit: number, offset: number): Promise<{ items: OrganizationOrder[]; total: number }> {
    const repo = AppDataSource.getRepository(OrganizationOrder);
    const [items, total] = await repo.findAndCount({ order: { createdAt: 'DESC' }, take: limit, skip: offset });
    return { items, total };
  }

  async listVendorScoped(limit: number, offset: number): Promise<{ items: OrganizationOrder[]; total: number }> {
    const repo = AppDataSource.getRepository(OrganizationOrder);
    const qb = repo
      .createQueryBuilder('o')
      .where('o.vendorId IS NOT NULL')
      .orderBy('o.createdAt', 'DESC')
      .offset(offset)
      .limit(limit);
    const items = await qb.getMany();
    const total = await repo.createQueryBuilder('o').where('o.vendorId IS NOT NULL').getCount();
    return { items, total };
  }

  async create(
    dto: CreateOrganizationOrderDto,
    actorSub: string,
    ip: string | undefined
  ): Promise<OrganizationOrder> {
    const repo = AppDataSource.getRepository(OrganizationOrder);
    const row = repo.create({
      vendorId: dto.vendorId ?? null,
      customerId: dto.customerId ?? null,
      referralCode: dto.referralCode ?? null,
      status: dto.status ?? 'created',
      isClaimed: dto.isClaimed ?? false,
      totalAmount: dto.totalAmount ?? '0',
      metadata: dto.metadata ?? null,
    });
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'CREATE',
      entityType: 'OrganizationOrder',
      entityId: row.id,
      metadata: { referralCode: row.referralCode },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async update(
    id: string,
    dto: UpdateOrganizationOrderDto,
    actorSub: string,
    ip: string | undefined
  ): Promise<OrganizationOrder> {
    const repo = AppDataSource.getRepository(OrganizationOrder);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Organization order not found');
    if (dto.vendorId !== undefined) row.vendorId = dto.vendorId;
    if (dto.customerId !== undefined) row.customerId = dto.customerId;
    if (dto.referralCode !== undefined) row.referralCode = dto.referralCode;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.isClaimed !== undefined) row.isClaimed = dto.isClaimed;
    if (dto.totalAmount !== undefined) row.totalAmount = dto.totalAmount;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'UPDATE',
      entityType: 'OrganizationOrder',
      entityId: row.id,
      metadata: { changes: dto },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async markVendorUnclaimed(
    vendorId: string,
    actorSub: string,
    ip: string | undefined
  ): Promise<{ vendorId: string; updated: number }> {
    const repo = AppDataSource.getRepository(OrganizationOrder);
    const result = await repo.update({ vendorId }, { isClaimed: false, status: 'unclaimed' });
    const updated = result.affected ?? 0;
    await this.audit.log({
      actorSub,
      action: 'BATCH_UPDATE',
      entityType: 'OrganizationOrder',
      entityId: vendorId,
      metadata: { batch: 'mark_unclaimed', updated },
      ipAddress: ip ?? null,
    });
    return { vendorId, updated };
  }

  async topReferrals(limit: number, offset: number): Promise<{ items: Array<{ referralCode: string; count: number }> }> {
    const repo = AppDataSource.getRepository(OrganizationOrder);
    const rows = await repo
      .createQueryBuilder('o')
      .select('o.referralCode', 'referralCode')
      .addSelect('COUNT(*)', 'count')
      .where('o.referralCode IS NOT NULL')
      .groupBy('o.referralCode')
      .orderBy('COUNT(*)', 'DESC')
      .offset(offset)
      .limit(limit)
      .getRawMany<{ referralCode: string; count: string }>();

    return {
      items: rows.map(r => ({ referralCode: r.referralCode, count: Number(r.count) || 0 })),
    };
  }
}
