import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { VendorPlan } from './entities/VendorPlan';
import { CreateVendorPlanDto } from './dto/create-vendor-plan.dto';
import { UpdateVendorPlanDto } from './dto/update-vendor-plan.dto';

export class VendorPlansService {
  private audit = new AuditService();

  async list(
    limit: number,
    offset: number,
    filters?: { planType?: 'local' | 'vip'; q?: string; includeInactive?: boolean },
  ): Promise<{ items: VendorPlan[]; total: number }> {
    const repo = AppDataSource.getRepository(VendorPlan);
    const qb = repo
      .createQueryBuilder('p')
      .orderBy('p.planType', 'ASC')
      .addOrderBy('p.tier', 'ASC')
      .addOrderBy('p.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (!filters?.includeInactive) qb.andWhere('p.isActive = :active', { active: true });
    if (filters?.planType) qb.andWhere('p.planType = :pt', { pt: filters.planType });
    if (filters?.q?.trim()) {
      qb.andWhere('(p.planName LIKE :q OR p.description LIKE :q)', { q: `%${filters.q.trim()}%` });
    }
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async getById(id: string): Promise<VendorPlan | null> {
    return AppDataSource.getRepository(VendorPlan).findOne({ where: { id } });
  }

  async create(dto: CreateVendorPlanDto, actorSub: string, ip: string | undefined): Promise<VendorPlan> {
    const repo = AppDataSource.getRepository(VendorPlan);
    const row = repo.create({
      planName: dto.planName.trim(),
      description: dto.description?.trim() || null,
      planType: dto.planType,
      tier: dto.tier,
      price: dto.price,
      validityDays: dto.validityDays,
      visibilityType: dto.visibilityType,
      radiusKm: dto.visibilityType === 'radius' ? dto.radiusKm ?? '5' : null,
      commissionPercent: dto.commissionPercent,
      maxUserRedemptionPercent: dto.maxUserRedemptionPercent,
      paymentMode: dto.paymentMode,
      promoBannerAds: dto.promoBannerAds ?? false,
      promoVideoAds: dto.promoVideoAds ?? false,
      promoPriorityListing: dto.promoPriorityListing ?? false,
      isActive: dto.isActive ?? true,
      metadata: dto.metadata ?? null,
    });
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'CREATE',
      entityType: 'VendorPlan',
      entityId: row.id,
      metadata: { planName: row.planName, planType: row.planType },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async update(id: string, dto: UpdateVendorPlanDto, actorSub: string, ip: string | undefined): Promise<VendorPlan> {
    const repo = AppDataSource.getRepository(VendorPlan);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Vendor plan not found');

    if (dto.planName !== undefined) row.planName = dto.planName.trim();
    if (dto.description !== undefined) row.description = dto.description?.trim() || null;
    if (dto.planType !== undefined) row.planType = dto.planType;
    if (dto.tier !== undefined) row.tier = dto.tier;
    if (dto.price !== undefined) row.price = dto.price;
    if (dto.validityDays !== undefined) row.validityDays = dto.validityDays;
    if (dto.visibilityType !== undefined) row.visibilityType = dto.visibilityType;
    if (dto.radiusKm !== undefined) row.radiusKm = dto.radiusKm || null;
    if (dto.commissionPercent !== undefined) row.commissionPercent = dto.commissionPercent;
    if (dto.maxUserRedemptionPercent !== undefined) row.maxUserRedemptionPercent = dto.maxUserRedemptionPercent;
    if (dto.paymentMode !== undefined) row.paymentMode = dto.paymentMode;
    if (dto.promoBannerAds !== undefined) row.promoBannerAds = dto.promoBannerAds;
    if (dto.promoVideoAds !== undefined) row.promoVideoAds = dto.promoVideoAds;
    if (dto.promoPriorityListing !== undefined) row.promoPriorityListing = dto.promoPriorityListing;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.metadata !== undefined) row.metadata = dto.metadata ?? null;
    if (row.visibilityType !== 'radius') row.radiusKm = null;

    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'UPDATE',
      entityType: 'VendorPlan',
      entityId: row.id,
      metadata: { changes: dto },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async remove(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(VendorPlan);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Vendor plan not found');
    await repo.remove(row);
    await this.audit.log({
      actorSub,
      action: 'DELETE',
      entityType: 'VendorPlan',
      entityId: id,
      metadata: { planName: row.planName },
      ipAddress: ip ?? null,
    });
  }
}

