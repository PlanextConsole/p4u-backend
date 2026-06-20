import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { PlatformVariable } from './entities/PlatformVariable';
import { OCCUPATION_ADMIN_CREATE_ENABLED_KEY, isPlatformVariableRowAllowingAction } from './platform-variable-value';
import { invalidatePlatformVarCache } from './platform-variable.reader';
import { WebsiteQuery } from './entities/WebsiteQuery';
import { CreatePlatformVariableDto } from './dto/create-platform-variable.dto';
import { UpdatePlatformVariableDto } from './dto/update-platform-variable.dto';
import { UpdateWebsiteQueryDto } from './dto/update-website-query.dto';

export class PlatformConfigAdminService {
  private audit = new AuditService();

  async listPlatformVariables(limit: number, offset: number): Promise<{ items: PlatformVariable[]; total: number }> {
    const repo = AppDataSource.getRepository(PlatformVariable);
    const [items, total] = await repo.findAndCount({ order: { createdAt: 'DESC' }, take: limit, skip: offset });
    return { items, total };
  }

  async getPlatformVariableByKey(key: string): Promise<PlatformVariable | null> {
    const repo = AppDataSource.getRepository(PlatformVariable);
    const lk = key.trim().toLowerCase();
    if (!lk) return null;
    return repo
      .createQueryBuilder('p')
      .where('LOWER(TRIM(p.key)) = :lk', { lk })
      .getOne();
  }

  /** Whether POST /occupations is allowed (reads `OCCUPATION_ADMIN_CREATE_ENABLED`). */
  async isOccupationAdminCreateEnabled(): Promise<boolean> {
    const row = await this.getPlatformVariableByKey(OCCUPATION_ADMIN_CREATE_ENABLED_KEY);
    return isPlatformVariableRowAllowingAction(row, true);
  }

  async createPlatformVariable(dto: CreatePlatformVariableDto, actorSub: string, ip: string | undefined): Promise<PlatformVariable> {
    const repo = AppDataSource.getRepository(PlatformVariable);
    const row = repo.create({
      key: dto.key,
      value: dto.value,
      category: dto.category ?? null,
      isActive: dto.isActive ?? true,
    });
    await repo.save(row);
    invalidatePlatformVarCache();
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'PlatformVariable', entityId: row.id, metadata: { key: row.key }, ipAddress: ip ?? null });
    return row;
  }

  async updatePlatformVariable(id: string, dto: UpdatePlatformVariableDto, actorSub: string, ip: string | undefined): Promise<PlatformVariable> {
    const repo = AppDataSource.getRepository(PlatformVariable);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Platform variable not found');
    if (dto.key !== undefined) row.key = dto.key;
    if (dto.value !== undefined) row.value = dto.value;
    if (dto.category !== undefined) row.category = dto.category;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    await repo.save(row);
    invalidatePlatformVarCache();
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'PlatformVariable', entityId: row.id, metadata: { changes: dto }, ipAddress: ip ?? null });
    return row;
  }

  async deletePlatformVariable(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(PlatformVariable);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Platform variable not found');
    await repo.remove(row);
    invalidatePlatformVarCache();
    await this.audit.log({ actorSub, action: 'DELETE', entityType: 'PlatformVariable', entityId: id, metadata: { key: row.key }, ipAddress: ip ?? null });
  }

  async listWebsiteQueries(limit: number, offset: number): Promise<{ items: WebsiteQuery[]; total: number }> {
    const repo = AppDataSource.getRepository(WebsiteQuery);
    const [items, total] = await repo.findAndCount({ order: { createdAt: 'DESC' }, take: limit, skip: offset });
    return { items, total };
  }

  async updateWebsiteQuery(id: string, dto: UpdateWebsiteQueryDto, actorSub: string, ip: string | undefined): Promise<WebsiteQuery> {
    const repo = AppDataSource.getRepository(WebsiteQuery);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Website query not found');
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.resolvedBy !== undefined) row.resolvedBy = dto.resolvedBy;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    if (dto.status && (dto.status === 'resolved' || dto.status === 'closed')) {
      row.resolvedAt = new Date();
    }
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'WebsiteQuery', entityId: row.id, metadata: { changes: dto }, ipAddress: ip ?? null });
    return row;
  }
}
