import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { Post } from './entities/Post';
import { AdvertisementFeedItem } from './entities/AdvertisementFeedItem';
import { ObjectionableFeedLog } from './entities/ObjectionableFeedLog';
import { SocialPostComment } from './entities/SocialPostComment';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateObjectionableLogDto } from './dto/update-objectionable-log.dto';
import { randomUUID } from 'crypto';

export class PostsAdminService {
  private audit = new AuditService();

  async listAdvertisementFeed(limit: number, offset: number): Promise<{ items: AdvertisementFeedItem[]; total: number }> {
    const repo = AppDataSource.getRepository(AdvertisementFeedItem);
    const [items, total] = await repo.findAndCount({ order: { sortOrder: 'ASC', createdAt: 'DESC' }, take: limit, skip: offset });
    return { items, total };
  }

  async listPosts(limit: number, offset: number): Promise<{ items: Post[]; total: number }> {
    const repo = AppDataSource.getRepository(Post);
    const [items, total] = await repo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async getPost(id: string): Promise<Post | null> {
    return AppDataSource.getRepository(Post).findOne({ where: { id } });
  }

  async createAdvertisementFeedItem(dto: any, actorSub: string, ip: string | undefined): Promise<AdvertisementFeedItem> {
    const repo = AppDataSource.getRepository(AdvertisementFeedItem);
    const row = repo.create({
      id: randomUUID(),
      title: dto.title,
      imageUrl: dto.imageUrl ?? null,
      redirectUrl: dto.redirectUrl ?? null,
      status: dto.status ?? 'active',
      sortOrder: dto.sortOrder ?? 0,
      metadata: dto.metadata ?? null,
    });
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'AdvertisementFeedItem', entityId: row.id, metadata: { title: row.title }, ipAddress: ip ?? null });
    return row;
  }

  async updateAdvertisementFeedItem(id: string, dto: any, actorSub: string, ip: string | undefined): Promise<AdvertisementFeedItem> {
    const repo = AppDataSource.getRepository(AdvertisementFeedItem);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Advertisement feed item not found');
    if (dto.title !== undefined) row.title = dto.title;
    if (dto.imageUrl !== undefined) row.imageUrl = dto.imageUrl;
    if (dto.redirectUrl !== undefined) row.redirectUrl = dto.redirectUrl;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'AdvertisementFeedItem', entityId: row.id, metadata: { changes: dto }, ipAddress: ip ?? null });
    return row;
  }

  async deleteAdvertisementFeedItem(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(AdvertisementFeedItem);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Advertisement feed item not found');
    await repo.remove(row);
    await this.audit.log({ actorSub, action: 'DELETE', entityType: 'AdvertisementFeedItem', entityId: id, metadata: { title: row.title }, ipAddress: ip ?? null });
  }

  async createPost(dto: CreatePostDto, actorSub: string, ip: string | undefined): Promise<Post> {
    const repo = AppDataSource.getRepository(Post);
    const row = repo.create({
      authorCustomerId: dto.authorCustomerId ?? null,
      authorVendorId: dto.authorVendorId ?? null,
      content: dto.content ?? null,
      status: dto.status ?? 'published',
      mediaJson: dto.mediaJson ?? null,
      metadata: dto.metadata ?? null,
    });
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'Post', entityId: row.id, metadata: { status: row.status }, ipAddress: ip ?? null });
    return row;
  }

  async updatePost(id: string, dto: UpdatePostDto, actorSub: string, ip: string | undefined): Promise<Post> {
    const repo = AppDataSource.getRepository(Post);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Post not found');
    if (dto.authorCustomerId !== undefined) row.authorCustomerId = dto.authorCustomerId;
    if (dto.authorVendorId !== undefined) row.authorVendorId = dto.authorVendorId;
    if (dto.content !== undefined) row.content = dto.content;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.mediaJson !== undefined) row.mediaJson = dto.mediaJson;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'Post', entityId: row.id, metadata: { changes: dto }, ipAddress: ip ?? null });
    return row;
  }

  async deletePost(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(Post);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Post not found');
    await repo.remove(row);
    await this.audit.log({ actorSub, action: 'DELETE', entityType: 'Post', entityId: id, ipAddress: ip ?? null });
  }

  async listObjectionableLogs(
    limit: number,
    offset: number,
    purpose?: string
  ): Promise<{ items: ObjectionableFeedLog[]; total: number }> {
    const repo = AppDataSource.getRepository(ObjectionableFeedLog);
    const qb = repo.createQueryBuilder('o').orderBy('o.createdAt', 'DESC').offset(offset).limit(limit);
    if (purpose && purpose !== 'all') {
      qb.andWhere('o.status = :s', { s: purpose });
    }
    const items = await qb.getMany();
    const totalQb = repo.createQueryBuilder('o');
    if (purpose && purpose !== 'all') totalQb.where('o.status = :s', { s: purpose });
    const total = await totalQb.getCount();
    return { items, total };
  }

  async batchUpdateObjectionableLog(
    id: string,
    dto: UpdateObjectionableLogDto,
    actorSub: string,
    ip: string | undefined
  ): Promise<ObjectionableFeedLog> {
    const repo = AppDataSource.getRepository(ObjectionableFeedLog);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Objectionable feed log not found');
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.reasonCode !== undefined) row.reasonCode = dto.reasonCode;
    if (dto.reviewNotes !== undefined) row.reviewNotes = dto.reviewNotes;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    row.reviewedBy = actorSub;
    row.reviewedAt = new Date();
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'BATCH_UPDATE', entityType: 'ObjectionableFeedLog', entityId: row.id, metadata: { changes: dto }, ipAddress: ip ?? null });
    return row;
  }

  async commentsBatchCustomersFor(
    userId: string,
    actorSub: string,
    ip: string | undefined,
  ): Promise<{ id: string; updated: number; note: string }> {
    const result = await AppDataSource.getRepository(SocialPostComment).update(
      { userId },
      { status: 'hidden', contentText: '[removed]' },
    );
    const updated = result.affected ?? 0;
    await this.audit.log({
      actorSub,
      action: 'BATCH_UPDATE',
      entityType: 'SocialPostComment',
      entityId: userId,
      metadata: { batch: 'customer_comments_cleanup', updated },
      ipAddress: ip ?? null,
    });
    return {
      id: userId,
      updated,
      note: updated > 0 ? 'User comments hidden.' : 'No comments matched user.',
    };
  }
}
