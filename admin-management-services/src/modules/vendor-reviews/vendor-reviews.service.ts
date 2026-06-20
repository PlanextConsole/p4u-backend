import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { VendorReview } from './entities/VendorReview';
import { CreateVendorReviewDto } from './dto/create-vendor-review.dto';

export class VendorReviewsAdminService {
  private audit = new AuditService();

  async list(limit: number, offset: number): Promise<{ items: VendorReview[]; total: number }> {
    const repo = AppDataSource.getRepository(VendorReview);
    const [items, total] = await repo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async create(dto: CreateVendorReviewDto, actorSub: string, ip: string | undefined): Promise<VendorReview> {
    const repo = AppDataSource.getRepository(VendorReview);
    const row = repo.create({
      vendorId: dto.vendorId,
      customerId: dto.customerId ?? null,
      rating: dto.rating,
      review: dto.review ?? null,
      status: dto.status ?? 'published',
      metadata: dto.metadata ?? null,
    });
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'CREATE',
      entityType: 'VendorReview',
      entityId: row.id,
      metadata: { vendorId: row.vendorId, rating: row.rating },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async update(id: string, dto: any, actorSub: string, ip: string | undefined): Promise<VendorReview> {
    const repo = AppDataSource.getRepository(VendorReview);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Vendor review not found');
    if (dto.rating !== undefined) row.rating = dto.rating;
    if (dto.review !== undefined) row.review = dto.review;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'UPDATE',
      entityType: 'VendorReview',
      entityId: row.id,
      metadata: { changes: dto },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async delete(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(VendorReview);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Vendor review not found');
    await repo.remove(row);
    await this.audit.log({
      actorSub,
      action: 'DELETE',
      entityType: 'VendorReview',
      entityId: id,
      metadata: { vendorId: row.vendorId },
      ipAddress: ip ?? null,
    });
  }
}
