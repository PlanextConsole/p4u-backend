import { AppDataSource } from '../../../config/database';
import { AppScreenLayout } from '../entities/AppScreenLayout';
import { AuditService } from './audit.service';
import { CreateAppLayoutDto } from '../dto/CreateAppLayoutDto';
import { UpdateAppLayoutDto } from '../dto/UpdateAppLayoutDto';

export class LayoutService {
  private audit = new AuditService();

  async list(screenKey?: string): Promise<AppScreenLayout[]> {
    const repo = AppDataSource.getRepository(AppScreenLayout);
    const qb = repo.createQueryBuilder('l').orderBy('l.priority', 'DESC').addOrderBy('l.updatedAt', 'DESC');
    if (screenKey) {
      qb.andWhere('l.screenKey = :sk', { sk: screenKey });
    }
    return qb.getMany();
  }

  async getById(id: string): Promise<AppScreenLayout | null> {
    return AppDataSource.getRepository(AppScreenLayout).findOne({ where: { id } });
  }

  /** Published layouts for a screen, highest priority first (for app consumption). */
  async listPublishedForScreen(screenKey: string, at: Date = new Date()): Promise<AppScreenLayout[]> {
    const repo = AppDataSource.getRepository(AppScreenLayout);
    return repo
      .createQueryBuilder('l')
      .where('l.screenKey = :sk', { sk: screenKey })
      .andWhere('l.published = :pub', { pub: true })
      .andWhere('(l.validFrom IS NULL OR l.validFrom <= :at)', { at })
      .andWhere('(l.validTo IS NULL OR l.validTo >= :at)', { at })
      .orderBy('l.priority', 'DESC')
      .addOrderBy('l.updatedAt', 'DESC')
      .getMany();
  }

  async create(dto: CreateAppLayoutDto, actorSub: string, ip: string | undefined): Promise<AppScreenLayout> {
    const repo = AppDataSource.getRepository(AppScreenLayout);
    const layout = repo.create({
      screenKey: dto.screenKey,
      displayName: dto.displayName,
      widgetConfig: dto.widgetConfig,
      targetingRules: dto.targetingRules ?? null,
      published: false,
      priority: dto.priority ?? 0,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validTo: dto.validTo ? new Date(dto.validTo) : null,
    });
    await repo.save(layout);
    await this.audit.log({
      actorSub,
      action: 'CREATE',
      entityType: 'AppScreenLayout',
      entityId: layout.id,
      metadata: { screenKey: layout.screenKey, displayName: layout.displayName },
      ipAddress: ip ?? null,
    });
    return layout;
  }

  async update(
    id: string,
    dto: UpdateAppLayoutDto,
    actorSub: string,
    ip: string | undefined
  ): Promise<AppScreenLayout> {
    const repo = AppDataSource.getRepository(AppScreenLayout);
    const layout = await repo.findOne({ where: { id } });
    if (!layout) {
      throw new Error('Layout not found');
    }
    if (dto.screenKey !== undefined) layout.screenKey = dto.screenKey;
    if (dto.displayName !== undefined) layout.displayName = dto.displayName;
    if (dto.widgetConfig !== undefined) layout.widgetConfig = dto.widgetConfig;
    if (dto.targetingRules !== undefined) layout.targetingRules = dto.targetingRules;
    if (dto.published !== undefined) layout.published = dto.published;
    if (dto.priority !== undefined) layout.priority = dto.priority;
    if (dto.validFrom !== undefined) layout.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validTo !== undefined) layout.validTo = dto.validTo ? new Date(dto.validTo) : null;
    await repo.save(layout);
    await this.audit.log({
      actorSub,
      action: 'UPDATE',
      entityType: 'AppScreenLayout',
      entityId: layout.id,
      metadata: { changes: dto },
      ipAddress: ip ?? null,
    });
    return layout;
  }

  async publish(id: string, actorSub: string, ip: string | undefined): Promise<AppScreenLayout> {
    return this.update(id, { published: true }, actorSub, ip);
  }

  async unpublish(id: string, actorSub: string, ip: string | undefined): Promise<AppScreenLayout> {
    return this.update(id, { published: false }, actorSub, ip);
  }
}
