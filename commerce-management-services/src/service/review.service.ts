import { randomUUID } from 'crypto';
import { AppDataSource } from '../config/database';
import { Review } from '../entities/Review';

export class ReviewService {
  private repo = AppDataSource.getRepository(Review);

  async createOrUpdateReview(customerId: string, data: Partial<Review>): Promise<Review> {
    const existing = await this.repo.findOne({
      where: {
        customerId,
        targetType: data.targetType!,
        targetId: data.targetId!,
      },
    });
    if (existing) {
      if (data.rating !== undefined) existing.rating = data.rating;
      if (data.title !== undefined) existing.title = data.title;
      if (data.reviewText !== undefined) existing.reviewText = data.reviewText;
      if (data.imagesJson !== undefined) existing.imagesJson = data.imagesJson;
      if (data.metadata !== undefined) existing.metadata = data.metadata;
      return this.repo.save(existing);
    }
    const row = this.repo.create({ ...data, id: randomUUID(), customerId });
    return this.repo.save(row);
  }

  async listReviews(targetType: string, targetId: string, limit: number, offset: number) {
    const [items, total] = await this.repo.findAndCount({
      where: { targetType, targetId, status: 'published' },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async getAverageRating(targetType: string, targetId: string) {
    const result = await this.repo
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'average')
      .addSelect('COUNT(r.id)', 'count')
      .where('r.target_type = :targetType', { targetType })
      .andWhere('r.target_id = :targetId', { targetId })
      .andWhere('r.status = :status', { status: 'published' })
      .getRawOne();
    return {
      average: result?.average ? Math.round(Number(result.average) * 10) / 10 : 0,
      count: Number(result?.count || 0),
    };
  }
}
