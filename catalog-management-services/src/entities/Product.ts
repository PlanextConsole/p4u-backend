import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/** Mirrors admin `catalog_products` (shared DB) so public catalog API returns image URLs. */
@Entity('catalog_products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  name!: string;

  @Column({ type: 'boolean', default: false })
  availability!: boolean;

  @Column({ name: 'vendor_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  vendorId!: string | null;

  @Column({ name: 'category_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  categoryId!: string | null;

  @Column({ name: 'service_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  serviceId!: string | null;

  @Column({ name: 'sell_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  sellPrice!: string;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount!: string;

  @Column({ name: 'final_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  finalPrice!: string;

  @Column({ name: 'tax_configuration_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  taxConfigurationId!: string | null;

  @Column({ name: 'duration_hours', type: 'int', default: 0 })
  durationHours!: number;

  @Column({ name: 'duration_minutes', type: 'int', default: 0 })
  durationMinutes!: number;

  @Column({ name: 'short_description', type: 'text', nullable: true })
  shortDescription!: string | null;

  @Column({ name: 'long_description', type: 'text', nullable: true })
  longDescription!: string | null;

  @Column({ name: 'promise_p4u', type: 'text', nullable: true })
  promiseP4u!: string | null;

  @Column({ name: 'help_line_number', type: 'text', nullable: true })
  helpLineNumber!: string | null;

  @Column({ name: 'thumbnail_url', type: 'varchar', length: 512, nullable: true })
  thumbnailUrl!: string | null;

  @Column({ name: 'banner_urls', type: 'json', nullable: true })
  bannerUrls!: string[] | null;

  @Column({ name: 'commission_override_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  commissionOverridePercent!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  price!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  @Index()
  isActive!: boolean;

  @Column({ name: 'moderation_status', type: 'varchar', length: 32, default: 'approved' })
  @Index()
  moderationStatus!: string;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
