import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';


@Entity('catalog_service_items')
export class CatalogServiceItem {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  /** FK to {@link ServiceCategory} root (legacy / denormalized parent). */
  @Column({ name: 'service_category_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  serviceCategoryId!: string | null;

  /** FK to {@link ServiceSubcategory} — preferred leaf taxonomy link (like product subcategory). */
  @Column({ name: 'service_subcategory_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  serviceSubcategoryId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  name!: string;

  @Column({ type: 'boolean', default: false })
  availability!: boolean;

  @Column({ type: 'boolean', default: false })
  trending!: boolean;

  @Column({ name: 'icon_url', type: 'varchar', length: 512, nullable: true })
  iconUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /**
   * Optional listing / “from” price in the user Services tab. Final bookable price
   * comes from `catalog_vendor_services` per vendor.
   */
  @Column({ name: 'base_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  basePrice!: string | null;

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
