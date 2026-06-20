import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { Banner } from './entities/Banner';
import { PopupBanner } from './entities/PopupBanner';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

export class BannersAdminService {
  private audit = new AuditService();

  async listBanners(): Promise<Banner[]> {
    return AppDataSource.getRepository(Banner).find({ order: { sortOrder: 'ASC', createdAt: 'DESC' } });
  }

  async createBanner(dto: CreateBannerDto, actorSub: string, ip: string | undefined): Promise<Banner> {
    const repo = AppDataSource.getRepository(Banner);
    const row = repo.create({
      title: dto.title,
      imageUrl: dto.imageUrl,
      redirectUrl: dto.redirectUrl ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      metadata: dto.metadata ?? null,
    });
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'Banner', entityId: row.id, metadata: { title: row.title }, ipAddress: ip ?? null });
    return row;
  }

  async updateBanner(id: string, dto: UpdateBannerDto, actorSub: string, ip: string | undefined): Promise<Banner> {
    const repo = AppDataSource.getRepository(Banner);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Banner not found');
    if (dto.title !== undefined) row.title = dto.title;
    if (dto.imageUrl !== undefined) row.imageUrl = dto.imageUrl;
    if (dto.redirectUrl !== undefined) row.redirectUrl = dto.redirectUrl;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'Banner', entityId: row.id, metadata: { changes: dto }, ipAddress: ip ?? null });
    return row;
  }

  async getBanner(id: string): Promise<Banner | null> {
    return AppDataSource.getRepository(Banner).findOne({ where: { id } });
  }

  async deleteBanner(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(Banner);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Banner not found');
    await repo.remove(row);
    await this.audit.log({ actorSub, action: 'DELETE', entityType: 'Banner', entityId: id, metadata: { title: row.title }, ipAddress: ip ?? null });
  }

  async listPopupBanners(): Promise<PopupBanner[]> {
    return AppDataSource.getRepository(PopupBanner).find({ order: { createdAt: 'DESC' } });
  }

  async createPopupBanner(dto: CreateBannerDto, actorSub: string, ip: string | undefined): Promise<PopupBanner> {
    const repo = AppDataSource.getRepository(PopupBanner);
    const row = repo.create({
      title: dto.title,
      imageUrl: dto.imageUrl,
      redirectUrl: dto.redirectUrl ?? null,
      isActive: dto.isActive ?? true,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validTo: dto.validTo ? new Date(dto.validTo) : null,
      metadata: dto.metadata ?? null,
    });
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'PopupBanner', entityId: row.id, metadata: { title: row.title }, ipAddress: ip ?? null });
    return row;
  }

  async getPopupBanner(id: string): Promise<PopupBanner | null> {
    return AppDataSource.getRepository(PopupBanner).findOne({ where: { id } });
  }

  async deletePopupBanner(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(PopupBanner);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Popup banner not found');
    await repo.remove(row);
    await this.audit.log({ actorSub, action: 'DELETE', entityType: 'PopupBanner', entityId: id, metadata: { title: row.title }, ipAddress: ip ?? null });
  }

  async updatePopupBanner(id: string, dto: UpdateBannerDto, actorSub: string, ip: string | undefined): Promise<PopupBanner> {
    const repo = AppDataSource.getRepository(PopupBanner);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Popup banner not found');
    if (dto.title !== undefined) row.title = dto.title;
    if (dto.imageUrl !== undefined) row.imageUrl = dto.imageUrl;
    if (dto.redirectUrl !== undefined) row.redirectUrl = dto.redirectUrl;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.validFrom !== undefined) row.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validTo !== undefined) row.validTo = dto.validTo ? new Date(dto.validTo) : null;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'PopupBanner', entityId: row.id, metadata: { changes: dto }, ipAddress: ip ?? null });
    return row;
  }
}
