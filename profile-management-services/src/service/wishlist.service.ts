import { AppDataSource } from '../config/database';
import { WishlistItem } from '../entities/WishlistItem';

export class WishlistService {
  private repo = AppDataSource.getRepository(WishlistItem);

  async listWishlist(customerId: string, limit: number, offset: number) {
    const [items, total] = await this.repo.findAndCount({
      where: { customerId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async addToWishlist(customerId: string, productId: string, vendorId?: string): Promise<WishlistItem> {
    const existing = await this.repo.findOne({ where: { customerId, productId } });
    if (existing) return existing;
    const row = this.repo.create({ customerId, productId, vendorId: vendorId || null });
    return this.repo.save(row);
  }

  async removeFromWishlist(customerId: string, productId: string): Promise<void> {
    const row = await this.repo.findOne({ where: { customerId, productId } });
    if (!row) throw new Error('Wishlist item not found');
    await this.repo.remove(row);
  }
}
