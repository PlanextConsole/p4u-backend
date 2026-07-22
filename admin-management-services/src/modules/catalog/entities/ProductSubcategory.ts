import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';


/** Product subcategory: one level under a product category. */
@Entity('product_subcategories')
export class ProductSubcategory {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'product_category_id', type: 'varchar', length: 36 })
  @Index()
  productCategoryId!: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  name!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  @Index()
  slug!: string | null;

  @Column({ type: 'boolean', default: false })
  availability!: boolean;

  @Column({ type: 'boolean', default: false })
  emergency!: boolean;

  @Column({ type: 'boolean', default: false })
  trending!: boolean;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'thumbnail_url', type: 'varchar', length: 512, nullable: true })
  thumbnailUrl!: string | null;

  @Column({ name: 'banner_urls', type: 'json', nullable: true })
  bannerUrls!: string[] | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  @Index()
  isActive!: boolean;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
