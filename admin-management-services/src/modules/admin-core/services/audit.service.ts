import { AppDataSource } from '../../../config/database';
import { AdminAuditLog } from '../entities/AdminAuditLog';

export interface AuditLogParams {
  actorSub: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export class AuditService {
  async log(params: AuditLogParams): Promise<void> {
    const repo = AppDataSource.getRepository(AdminAuditLog);
    const row = repo.create({
      actorSub: params.actorSub,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      metadata: params.metadata ?? null,
      ipAddress: params.ipAddress ?? null,
    });
    await repo.save(row);
  }

  async list(options: {
    page: number;
    limit: number;
    entityType?: string;
    actorSub?: string;
  }): Promise<{ items: AdminAuditLog[]; total: number }> {
    const repo = AppDataSource.getRepository(AdminAuditLog);
    const qb = repo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC');
    if (options.entityType) {
      qb.andWhere('a.entityType = :entityType', { entityType: options.entityType });
    }
    if (options.actorSub) {
      qb.andWhere('a.actorSub = :actorSub', { actorSub: options.actorSub });
    }
    const total = await qb.getCount();
    const items = await qb
      .clone()
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getMany();
    return { items, total };
  }
}
