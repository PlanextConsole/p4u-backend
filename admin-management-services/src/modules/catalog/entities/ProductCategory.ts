import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/** Top-level product taxonomy (shop / catalog). */
@Entity('product_categories')
export class ProductCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

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

  /** Per-category commission % override. Beats vendor & plan, beaten by product override. */
  @Column({ name: 'commission_override_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  commissionOverridePercent!: string | null;

  @Column({ name: 'icon_url', type: 'varchar', length: 512, nullable: true })
  iconUrl!: string | null;

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
