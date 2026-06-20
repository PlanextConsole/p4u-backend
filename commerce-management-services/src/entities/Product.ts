import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/** Read-only mirror of admin's `catalog_products`. Projects only what commerce uses for pricing. */
@Entity('catalog_products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'vendor_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  vendorId!: string | null;

  @Column({ name: 'category_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  categoryId!: string | null;

  @Column({ name: 'sell_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  sellPrice!: string;

  @Column({ name: 'final_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  finalPrice!: string;

  @Column({ name: 'commission_override_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  commissionOverridePercent!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
