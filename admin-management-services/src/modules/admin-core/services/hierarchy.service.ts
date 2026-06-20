import { Repository } from 'typeorm';
import { AppDataSource } from '../../../config/database';
import { HierarchyNode } from '../entities/HierarchyNode';
import { AuditService } from './audit.service';
import { CreateHierarchyNodeDto } from '../dto/CreateHierarchyNodeDto';
import { UpdateHierarchyNodeDto } from '../dto/UpdateHierarchyNodeDto';

export class HierarchyService {
  private audit = new AuditService();

  async list(includeInactive: boolean): Promise<HierarchyNode[]> {
    const repo = AppDataSource.getRepository(HierarchyNode);
    const qb = repo.createQueryBuilder('n').orderBy('n.createdAt', 'ASC');
    if (!includeInactive) {
      qb.andWhere('n.isActive = :active', { active: true });
    }
    return qb.getMany();
  }

  async getById(id: string): Promise<HierarchyNode | null> {
    return AppDataSource.getRepository(HierarchyNode).findOne({ where: { id } });
  }

  async create(dto: CreateHierarchyNodeDto, actorSub: string, ip: string | undefined): Promise<HierarchyNode> {
    const repo = AppDataSource.getRepository(HierarchyNode);
    if (dto.parentId) {
      const parent = await repo.findOne({ where: { id: dto.parentId } });
      if (!parent) {
        throw new Error('Parent node not found');
      }
    }
    const node = repo.create({
      parentId: dto.parentId ?? null,
      name: dto.name,
      nodeType: dto.nodeType.toUpperCase(),
      responsibleUserId: dto.responsibleUserId ?? null,
      geoZone: dto.geoZone ?? null,
      isActive: true,
    });
    await repo.save(node);
    await this.audit.log({
      actorSub,
      action: 'CREATE',
      entityType: 'HierarchyNode',
      entityId: node.id,
      metadata: { name: node.name, nodeType: node.nodeType },
      ipAddress: ip ?? null,
    });
    return node;
  }

  async update(
    id: string,
    dto: UpdateHierarchyNodeDto,
    actorSub: string,
    ip: string | undefined
  ): Promise<HierarchyNode> {
    const repo = AppDataSource.getRepository(HierarchyNode);
    const node = await repo.findOne({ where: { id } });
    if (!node) {
      throw new Error('Node not found');
    }
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new Error('Node cannot be its own parent');
      }
      if (dto.parentId) {
        const parent = await repo.findOne({ where: { id: dto.parentId } });
        if (!parent) {
          throw new Error('Parent node not found');
        }
        const wouldCycle = await this.isDescendant(repo, id, dto.parentId);
        if (wouldCycle) {
          throw new Error('Invalid parent: would create a cycle');
        }
      }
      node.parentId = dto.parentId;
    }
    if (dto.name !== undefined) node.name = dto.name;
    if (dto.nodeType !== undefined) node.nodeType = dto.nodeType.toUpperCase();
    if (dto.responsibleUserId !== undefined) node.responsibleUserId = dto.responsibleUserId;
    if (dto.geoZone !== undefined) node.geoZone = dto.geoZone;
    if (dto.isActive !== undefined) node.isActive = dto.isActive;
    await repo.save(node);
    await this.audit.log({
      actorSub,
      action: 'UPDATE',
      entityType: 'HierarchyNode',
      entityId: node.id,
      metadata: { changes: dto },
      ipAddress: ip ?? null,
    });
    return node;
  }

  /** True if candidateParentId is rootId or any descendant of rootId. */
  private async isDescendant(
    repo: Repository<HierarchyNode>,
    rootId: string,
    candidateParentId: string
  ): Promise<boolean> {
    let current: string | null = candidateParentId;
    const visited = new Set<string>();
    while (current) {
      if (current === rootId) return true;
      if (visited.has(current)) return true;
      visited.add(current);
      const row = await repo.findOne({ where: { id: current } });
      current = row?.parentId ?? null;
    }
    return false;
  }
}
