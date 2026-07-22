import { randomUUID } from 'crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('food_menu_items')
export class FoodMenuItem {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'restaurant_id', type: 'varchar', length: 36 })
  @Index()
  restaurantId!: string;

  @Column({ name: 'category_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  categoryId!: string | null;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price!: string;

  @Column({ name: 'discounted_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  discountedPrice!: string | null;

  @Column({ name: 'is_veg', type: 'boolean', default: true })
  isVeg!: boolean;

  @Column({ name: 'spice_level', type: 'varchar', length: 24, nullable: true })
  spiceLevel!: string | null;

  @Column({ name: 'image_url', type: 'varchar', length: 1024, nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'json', nullable: true })
  addons!: unknown[] | null;

  @Column({ type: 'json', nullable: true })
  customizations!: unknown[] | null;

  @Column({ type: 'int', default: 1 })
  serves!: number;

  @Column({ name: 'prep_minutes', type: 'int', default: 20 })
  prepMinutes!: number;

  @Column({ name: 'gst_rate', type: 'decimal', precision: 5, scale: 2, default: 5 })
  gstRate!: string;

  @Column({ name: 'in_stock', type: 'boolean', default: true })
  @Index()
  inStock!: boolean;

  @Column({ name: 'is_bestseller', type: 'boolean', default: false })
  isBestseller!: boolean;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder!: number;

  @Column({ name: 'dietary_tags', type: 'json', nullable: true })
  dietaryTags!: string[] | null;

  @Column({ type: 'int', nullable: true })
  calories!: number | null;

  @Column({ name: 'gallery_urls', type: 'json', nullable: true })
  galleryUrls!: string[] | null;

  @Column({ name: 'order_count', type: 'int', default: 0 })
  orderCount!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
