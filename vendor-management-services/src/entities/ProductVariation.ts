import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('catalog_product_variations')
export class ProductVariation {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', type: 'varchar', length: 36 })
  @Index()
  productId!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sku!: string | null;

  @Column({ type: 'json' })
  attributes!: Record<string, string>;

  @Column({ name: 'sell_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  sellPrice!: string;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount!: string;

  @Column({ name: 'final_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  finalPrice!: string;

  @Column({ type: 'int', default: 0 })
  quantity!: number;

  @Column({ name: 'thumbnail_url', type: 'varchar', length: 512, nullable: true })
  thumbnailUrl!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
